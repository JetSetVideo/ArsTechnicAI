/**
 * server.ts — Ars Technic AI unified host.
 *
 * One origin, one engine proxy, two surfaces:
 *   /            Home (project mission control)
 *   /blueprint/  Workshop — graph + restorer desk on one page
 *   /desk/?embed=1  Desk SPA for the workshop iframe only
 *   /api/*       → ArchiveRestorer engine (same-origin)
 *   /ws          → engine progress socket
 *   /shared/*    → controls.json schema
 *
 * Security: static roots are path-jailed with safeJoin; the engine stays on
 * loopback; host/accept-encoding are stripped on proxy; WS upgrades are gated.
 */

import { libraryRoot, loadLibrary, toPayload } from "./bridge/library.ts";
import { loadLatestLineage, saveLineage, writeVersionedAsset } from "./bridge/lineage_store.ts";
import { HybridLineage } from "./core/hybrid.ts";
import { ColumnarError, parseFilter } from "./core/columnar.ts";
import { buildRegistry } from "./core/catalogue.ts";
import { type GateToken, gateAllows, preRunReport, summarise } from "./core/diagnostics.ts";
import type { GraphDocument } from "./core/graph.ts";
import type { NodeId } from "./core/ids.ts";
import {
  consentCovers,
  describeRun,
  estimateRun,
  MODELS,
  provider,
  PROVIDERS,
} from "./core/providers.ts";
import type { ConsentToken, PlannedCall } from "./core/providers.ts";
import {
  createStudioManifest,
  inferFlowMediaType,
  isStudioMediaType,
  type StudioMediaType,
  type StudioProjectCreate,
} from "./core/studio.ts";

const UI_PORT = Number(Deno.env.get("ARS_UI_PORT") ?? Deno.env.get("WIV_UI_PORT") ?? 8090);
const BACKEND_HOST = Deno.env.get("WIV_BACKEND") ?? Deno.env.get("RESTORER_BACKEND") ??
  "127.0.0.1:8000";
const BACKEND_HTTP = `http://${BACKEND_HOST}`;
const BACKEND_WS = `ws://${BACKEND_HOST}`;

const ROOT = new URL(".", import.meta.url).pathname;
const HOME_DIR = `${ROOT}ui/home`;
const BLUEPRINT_DIR = `${ROOT}ui/public`;
const DESK_DIR = Deno.env.get("RESTORER_UI_DIR") ??
  `${ROOT}../ArchiveRestorer/frontend/public`;
const SHARED_DIR = Deno.env.get("RESTORER_SHARED") ??
  `${ROOT}../ArchiveRestorer/shared`;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function mimeFor(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1
    ? "application/octet-stream"
    : (MIME[path.slice(dot)] ?? "application/octet-stream");
}

function safeJoin(base: string, requested: string): string | null {
  const clean = decodeURIComponent(requested).replace(/\\/g, "/");
  if (clean.includes("\0")) return null;
  const joined = `${base}/${clean}`.replace(/\/+/g, "/");
  const normalised = new URL(`file://${joined}`).pathname;
  const baseNorm = new URL(`file://${base}`).pathname.replace(/\/$/, "");
  return normalised.startsWith(baseNorm + "/") || normalised === baseNorm ? normalised : null;
}

async function serveStatic(dir: string, relPath: string): Promise<Response> {
  const full = safeJoin(dir, relPath);
  if (!full) return new Response("Forbidden", { status: 403 });
  try {
    const stat = await Deno.stat(full);
    if (stat.isDirectory) return await serveStatic(dir, `${relPath.replace(/\/$/, "")}/index.html`);
    const body = await Deno.readFile(full);
    return new Response(body, {
      headers: {
        "content-type": mimeFor(full),
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

async function proxyApi(request: Request, url: URL): Promise<Response> {
  const target = `${BACKEND_HTTP}${url.pathname}${url.search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("accept-encoding");

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? null : request.body,
      ...(request.body ? { duplex: "half" } : {}),
      redirect: "manual",
    } as RequestInit);

    const out = new Headers(upstream.headers);
    out.delete("content-encoding");
    out.delete("content-length");
    return new Response(upstream.body, { status: upstream.status, headers: out });
  } catch (error) {
    return Response.json({
      detail: `Cannot reach the restoration engine at ${BACKEND_HTTP}.`,
      error: error instanceof Error ? error.message : String(error),
      backend_down: true,
    }, { status: 502 });
  }
}

function bridgeSocket(request: Request): Response {
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Expected a WebSocket upgrade", { status: 400 });
  }

  const { socket: client, response } = Deno.upgradeWebSocket(request);
  const upstream = new WebSocket(`${BACKEND_WS}/ws`);
  const queued: (string | ArrayBufferLike | Blob)[] = [];
  let upstreamOpen = false;

  upstream.onopen = () => {
    upstreamOpen = true;
    for (const message of queued.splice(0)) upstream.send(message);
  };
  upstream.onmessage = (event) => {
    if (client.readyState === WebSocket.OPEN) client.send(event.data);
  };
  upstream.onclose = () => {
    if (client.readyState === WebSocket.OPEN) client.close(1000, "engine disconnected");
  };
  upstream.onerror = () => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "engine_unreachable", backend: BACKEND_WS }));
    }
    client.close();
  };

  client.onmessage = (event) => {
    if (upstreamOpen) upstream.send(event.data);
    else queued.push(event.data);
  };
  client.onclose = () => {
    if (upstream.readyState <= WebSocket.OPEN) upstream.close();
  };
  client.onerror = () => {
    if (upstream.readyState <= WebSocket.OPEN) upstream.close();
  };

  return response;
}

// ===========================================================================
// The disk: browsing folders, and saved workflows
// ===========================================================================
//
// The GitHub version's Explorer read the machine's own folders. Restoring that
// here means opening a filesystem to a browser, so the rules are narrow and
// stated rather than assumed:
//
//   - the listing is **jailed to one root** (`ARS_FILES_ROOT`, default $HOME);
//   - it lists **names and sizes only** — no endpoint here reads file bytes;
//   - the server already binds 127.0.0.1, so nothing off this machine reaches it.
//
// The alternative — letting the canvas open any absolute path — would make a
// localhost port into a file-exfiltration endpoint for any page in the browser
// that can reach it.

const FILES_ROOT = Deno.env.get("ARS_FILES_ROOT") ??
  Deno.env.get("HOME") ?? "/";

/** Extensions the restorer can actually do something with. */
const MEDIA_EXT = new Set([
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
  ".m4v",
  ".mpg",
  ".mpeg",
  ".png",
  ".jpg",
  ".jpeg",
  ".tif",
  ".tiff",
  ".webp",
  ".bmp",
  ".exr",
  ".dpx",
  ".wav",
  ".mp3",
  ".aac",
  ".flac",
]);

async function listDirectory(url: URL): Promise<Response> {
  const requested = url.searchParams.get("path") ?? "";
  const full = requested === "" ? FILES_ROOT : safeJoin(FILES_ROOT, requested);
  if (!full) return Response.json({ detail: "Outside the browsable root." }, { status: 403 });

  try {
    const entries: Array<Record<string, unknown>> = [];
    for await (const entry of Deno.readDir(full)) {
      // Dotfiles are noise in a media browser and are where credentials live.
      if (entry.name.startsWith(".")) continue;
      const rel = requested ? `${requested.replace(/\/$/, "")}/${entry.name}` : entry.name;
      if (entry.isDirectory) {
        entries.push({ name: entry.name, path: rel, kind: "dir" });
        continue;
      }
      if (!entry.isFile) continue;
      const dot = entry.name.lastIndexOf(".");
      const ext = dot === -1 ? "" : entry.name.slice(dot).toLowerCase();
      let size = 0;
      let modified = 0;
      try {
        const stat = await Deno.stat(`${full}/${entry.name}`);
        size = stat.size;
        modified = stat.mtime?.getTime() ?? 0;
      } catch {
        // A file that vanished between readDir and stat is simply skipped.
        continue;
      }
      entries.push({
        name: entry.name,
        path: rel,
        kind: "file",
        ext,
        size,
        modified,
        media: MEDIA_EXT.has(ext),
      });
    }

    // Folders first, then names, case-insensitively — the order a person
    // expects from every file browser they have ever used.
    entries.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" });
    });

    return Response.json({ root: FILES_ROOT, path: requested, entries });
  } catch (error) {
    return Response.json({
      detail: `Cannot read that folder.`,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 404 });
  }
}

const FLOWS_DIR = `${ROOT}workflows`;

/** Saved graphs, newest first. Names only — the bodies are fetched on demand. */
async function listFlows(): Promise<Response> {
  const flows: Array<Record<string, unknown>> = [];
  try {
    for await (const entry of Deno.readDir(FLOWS_DIR)) {
      if (!entry.isFile || !entry.name.endsWith(".json")) continue;
      try {
        const raw = await Deno.readTextFile(`${FLOWS_DIR}/${entry.name}`);
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const graph = parsed.graph as { nodes?: Record<string, { type?: string }> } | undefined;
        const nodeCount = Object.keys(graph?.nodes ?? {}).length;
        const mediaType = inferFlowMediaType({
          media_type: parsed.media_type,
          graph,
        });
        flows.push({
          id: entry.name.replace(/\.json$/, ""),
          name: parsed.name ?? entry.name,
          note: parsed.note ?? "",
          savedAt: parsed.savedAt ?? 0,
          nodes: nodeCount,
          media_type: mediaType,
        });
      } catch {
        // A corrupt flow is skipped rather than failing the whole listing —
        // one bad file must not make the panel unusable.
      }
    }
  } catch {
    // No workflows directory yet. An empty list is the honest answer.
  }
  flows.sort((a, b) => Number(b.savedAt) - Number(a.savedAt));
  return Response.json({ flows });
}

async function readFlow(id: string): Promise<Response> {
  const full = safeJoin(FLOWS_DIR, `${id}.json`);
  if (!full) return Response.json({ detail: "Bad flow id." }, { status: 403 });
  try {
    return new Response(await Deno.readFile(full), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch {
    return Response.json({ detail: "No such flow." }, { status: 404 });
  }
}

async function writeFlow(request: Request): Promise<Response> {
  let body: {
    id?: string;
    name?: string;
    note?: string;
    graph?: { nodes?: Record<string, { type?: string }> };
    media_type?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ detail: "Expected JSON." }, { status: 400 });
  }
  // The id becomes a filename, so it is derived rather than accepted: a
  // caller-supplied id is a path-traversal waiting to happen.
  const slug = (body.name ?? "flow").toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "").slice(0, 60) || "flow";
  const id = body.id?.match(/^[a-z0-9-]{1,80}$/) ? body.id : `${slug}-${Date.now()}`;
  const full = safeJoin(FLOWS_DIR, `${id}.json`);
  if (!full) return Response.json({ detail: "Bad flow id." }, { status: 403 });

  const graph = body.graph ?? {};
  const mediaType = inferFlowMediaType({
    media_type: body.media_type,
    graph,
  });
  const nodeCount = Object.keys(graph.nodes ?? {}).length;

  try {
    await Deno.mkdir(FLOWS_DIR, { recursive: true });
    await Deno.writeTextFile(
      full,
      JSON.stringify(
        {
          id,
          name: body.name ?? id,
          note: body.note ?? "",
          savedAt: Date.now(),
          media_type: mediaType,
          graph,
        },
        null,
        1,
      ),
    );
    return Response.json({ id, saved: true, nodes: nodeCount, media_type: mediaType });
  } catch (error) {
    return Response.json({
      detail: "Could not save that flow.",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Studio projects — metadata-only create, next to extract rather than instead
// ---------------------------------------------------------------------------

const WORKSPACE_DIR = Deno.env.get("RESTORER_WORKSPACE") ??
  Deno.env.get("ARS_WORKSPACE") ??
  `${ROOT}workspace`;

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string") {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function withStudioListFields(man: Record<string, unknown>): Record<string, unknown> {
  const frames = Number(man.frame_count ?? 0);
  const media = typeof man.media_type === "string" && isStudioMediaType(man.media_type)
    ? man.media_type
    : (frames > 0 ? "reel" : "movie") satisfies StudioMediaType;
  const assets = Array.isArray(man.assets) ? man.assets : [];
  const refs = Array.isArray(man.references) ? man.references : [];
  const relations = (man.relations && typeof man.relations === "object")
    ? man.relations as Record<string, unknown>
    : {};
  return {
    ...man,
    media_type: media,
    origin: man.origin ?? (frames > 0 ? "extract" : "studio"),
    relations: {
      assets: Array.isArray(relations.assets) ? relations.assets : [],
      references: Array.isArray(relations.references) ? relations.references : refs.map(String),
      workflows: Array.isArray(relations.workflows)
        ? relations.workflows
        : (man.workflow_id ? [String(man.workflow_id)] : []),
      projects: Array.isArray(relations.projects) ? relations.projects : [],
    },
    related_counts: {
      assets: assets.length,
      references: refs.length,
      workflows: man.workflow_id ? 1 : 0,
    },
  };
}

/** Engine 404s on studio ids. Home/Workshop still need a project record. */
async function readStudioProject(id: string): Promise<Record<string, unknown> | null> {
  const dir = safeJoin(WORKSPACE_DIR, id);
  if (!dir) return null;
  try {
    const man = JSON.parse(await Deno.readTextFile(`${dir}/project.json`)) as Record<string, unknown>;
    const listed = withStudioListFields(man);
    const frames = Number(listed.frame_count ?? 0);
    return {
      ...listed,
      frames,
      extraction: { frame_count: frames },
      manifest: {
        title: listed.name ?? listed.source_name ?? id,
        source_name: listed.source_name ?? listed.name ?? id,
        source_path: listed.source_path ?? "",
        frame_count: frames,
        params: {},
      },
    };
  } catch {
    return null;
  }
}

async function listStudioProjects(): Promise<Response> {
  const projects: Record<string, unknown>[] = [];
  try {
    for await (const entry of Deno.readDir(WORKSPACE_DIR)) {
      if (!entry.isDirectory) continue;
      const full = `${WORKSPACE_DIR}/${entry.name}/project.json`;
      try {
        const man = JSON.parse(await Deno.readTextFile(full)) as Record<string, unknown>;
        projects.push(withStudioListFields(man));
      } catch {
        // A folder without a readable manifest is not a project.
      }
    }
  } catch {
    // No workspace yet. An empty list is the honest answer.
  }
  projects.sort((a, b) => Number(b.created_at ?? 0) - Number(a.created_at ?? 0));
  return Response.json({ projects });
}

async function createStudioProject(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ detail: "Expected JSON." }, { status: 400 });
  }

  const mediaRaw = String(body.media_type ?? body.kind ?? "movie");
  if (!isStudioMediaType(mediaRaw)) {
    return Response.json({
      detail: `media_type must be one of: ${["movie", "tv", "reel", "comic", "manga", "music", "book"].join(", ")}.`,
    }, { status: 400 });
  }

  const input: StudioProjectCreate = {
    name: String(body.name ?? body.title ?? body.source_name ?? "").trim(),
    media_type: mediaRaw,
    ...(typeof body.length === "number" || typeof body.length === "string"
      ? { length: body.length }
      : {}),
    tags: asStringList(body.tags),
    models: asStringList(body.models),
    ...(body.favorite === true ? { favorite: true } : {}),
  };
  const manifest = createStudioManifest(input);
  const dir = safeJoin(WORKSPACE_DIR, manifest.project_id);
  if (!dir) return Response.json({ detail: "Bad project id." }, { status: 403 });

  try {
    await Deno.mkdir(`${dir}/assets`, { recursive: true });
    await Deno.mkdir(`${dir}/moodboard`, { recursive: true });
    await Deno.writeTextFile(
      `${dir}/project.json`,
      JSON.stringify(manifest, null, 2) + "\n",
    );
    return Response.json(
      { project_id: manifest.project_id, project: manifest, saved: true },
      { status: 201 },
    );
  } catch (error) {
    return Response.json({
      detail: "Could not create that project.",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

async function status(): Promise<Response> {
  try {
    const r = await fetch(`${BACKEND_HTTP}/api/health`, {
      signal: AbortSignal.timeout(2500),
    });
    return Response.json({
      ui: "ok",
      product: "Ars Technic AI",
      engine: r.ok ? "ok" : "error",
      port: UI_PORT,
      surfaces: { home: "/", workshop: "/blueprint/" },
    });
  } catch {
    return Response.json({
      ui: "ok",
      product: "Ars Technic AI",
      engine: "down",
      backend: BACKEND_HTTP,
    });
  }
}

// ---------------------------------------------------------------------------
// The reference library
// ---------------------------------------------------------------------------

const LIBRARY_DIR = libraryRoot();

/**
 * The library, parsed once and held.
 *
 * 160 cards is ~400 KB of JSON and a directory listing; re-reading it on every
 * canvas load would be wasteful, and re-reading it on every *card* would be
 * absurd. Held as a promise rather than a value so concurrent first requests
 * share one read instead of racing to do the same work three times.
 *
 * `?reload=1` drops it, which is what makes the library editable without
 * restarting: save a JSON file, hit reload, and the new card is there. That is
 * a development affordance and it is safe to leave in — the route reads files
 * this process could already read.
 */
let libraryCache: Promise<Awaited<ReturnType<typeof loadLibrary>>> | null = null;

function library() {
  libraryCache ??= loadLibrary(LIBRARY_DIR);
  return libraryCache;
}

async function serveLibrary(url: URL): Promise<Response> {
  if (url.searchParams.get("reload") === "1") libraryCache = null;
  const payload = toPayload(await library());
  return Response.json(payload, {
    // No caching: the whole point of `?reload=1` is that an edited shelf shows
    // up, and a cached response would make that work only after a hard refresh.
    headers: { "cache-control": "no-store" },
  });
}

/**
 * The catalogue, with each provider marked usable or not.
 *
 * [AGENT-SECURITY] This reports **whether** a key is present, never the key.
 * The distinction matters: the canvas needs to grey out a provider it cannot
 * reach and name the variable to set, and neither of those needs the secret.
 */
function serveModels(): Response {
  const providers = PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    locality: p.locality,
    hint: p.hint,
    keyEnv: p.keyEnv ?? null,
    configured: p.locality === "local"
      ? true
      : (p.keyEnv !== undefined && (Deno.env.get(p.keyEnv) ?? "") !== ""),
  }));
  return Response.json({ providers, models: MODELS }, {
    headers: { "cache-control": "no-store" },
  });
}

/**
 * Price a run before it happens.
 *
 * The canvas posts the calls it is about to make and gets back the sentence
 * the consent dialog leads with, plus a verdict on whatever token it already
 * holds. Computing the estimate *here* rather than in the browser is what makes
 * it enforceable: the same function gates the run, so a client that skipped the
 * dialog gets the same refusal.
 */
async function serveEstimate(request: Request): Promise<Response> {
  let body: { calls?: PlannedCall[]; graphDigest?: string; token?: ConsentToken | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const calls = Array.isArray(body.calls) ? body.calls : [];
  const digest = typeof body.graphDigest === "string" ? body.graphDigest : "";
  const estimate = estimateRun(calls);
  const verdict = consentCovers(estimate, digest, body.token ?? null);

  const missingKeys = [...new Set(calls.map((c) => c.modelId.split(":")[0] ?? ""))]
    .map((id) => provider(id))
    .filter((p) => p !== null && p.locality === "remote" && p.keyEnv !== undefined)
    .filter((p) => (Deno.env.get(p!.keyEnv!) ?? "") === "")
    .map((p) => ({ provider: p!.id, keyEnv: p!.keyEnv }));

  return Response.json({
    estimate,
    summary: describeRun(estimate),
    verdict,
    // Reported separately from the verdict because they are a different
    // problem with a different fix: consent is a decision, a missing key is a
    // configuration step, and conflating them produces "denied" where the
    // honest answer is "set FAL_KEY".
    missingKeys,
  });
}

// ---------------------------------------------------------------------------
// Lineage, versioned assets, and the pre-run gate
// ---------------------------------------------------------------------------

/**
 * A project's directory, or null for an id that is not a plain slug.
 * Lineage and assets live under workspace/<id>/, which is the only tree this
 * process may write.
 */
function projectDir(id: string): string | null {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(id)) return null;
  return safeJoin(WORKSPACE_DIR, id);
}

async function lineageRoute(request: Request, url: URL, id: string, rest: string): Promise<Response> {
  const dir = projectDir(id);
  if (!dir) return Response.json({ detail: "Bad project id." }, { status: 403 });

  if (rest === "" && request.method === "GET") {
    return Response.json(await loadLatestLineage(dir), { headers: { "cache-control": "no-store" } });
  }
  if (rest === "" && request.method === "POST") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ detail: "Expected JSON." }, { status: 400 });
    }
    const result = await saveLineage(dir, body);
    return result.ok
      ? Response.json(result, { status: 201 })
      : Response.json({ detail: result.reason }, { status: result.status });
  }
  if (rest === "/query" && request.method === "POST") {
    let body: { filter?: string; limit?: number };
    try {
      body = await request.json();
    } catch {
      return Response.json({ detail: "Expected JSON." }, { status: 400 });
    }
    const { snapshot, version } = await loadLatestLineage(dir);
    if (!snapshot) return Response.json({ version, rows: [], schema: [] });
    try {
      const store = HybridLineage.fromSnapshot(snapshot);
      const where = parseFilter(String(body.filter ?? ""));
      const hits = store.query(where).slice(0, Math.max(1, Math.min(body.limit ?? 500, 5000)));
      return Response.json({
        version,
        schema: store.columns.schema(),
        rows: hits.map(({ asset, record }) => ({
          ...record,
          label: asset.label,
          origin_type: asset.origin_type,
          depth: store.depth(asset.id),
          parents: store.parentsOf(asset.id),
        })),
      });
    } catch (error) {
      const status = error instanceof ColumnarError ? 400 : 500;
      return Response.json({ detail: error instanceof Error ? error.message : String(error) }, { status });
    }
  }
  if (rest === "/blueprint" && request.method === "GET") {
    const { snapshot } = await loadLatestLineage(dir);
    const store = snapshot ? HybridLineage.fromSnapshot(snapshot) : new HybridLineage();
    return Response.json(store.toBlueprint({
      workflow_id: `wf_${id}`,
      title: url.searchParams.get("title") ?? id,
      version: "2.2.0",
    }));
  }
  return Response.json({ detail: "Not found." }, { status: 404 });
}

/** POST /assets/<project>?name=file.png — raw body, always a new v{N}. */
async function assetRoute(request: Request, url: URL, id: string): Promise<Response> {
  const dir = projectDir(id);
  if (!dir) return Response.json({ detail: "Bad project id." }, { status: 403 });
  const name = url.searchParams.get("name") ?? "";
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) return Response.json({ detail: "Empty body." }, { status: 400 });
  const result = await writeVersionedAsset(dir, name, bytes);
  return result.ok
    ? Response.json(result, { status: 201 })
    : Response.json({ detail: result.reason }, { status: result.status });
}

const SERVER_REGISTRY = buildRegistry();

/**
 * Structural pre-run report plus the gate verdict for whatever token the
 * client holds. Same functions as the canvas uses, so a client that skipped
 * the dialog is refused here with the sentence it would have been shown.
 */
async function serveDiagnostics(request: Request): Promise<Response> {
  let body: {
    graph?: GraphDocument;
    seeds?: string[];
    sequenceLength?: number;
    frameWidth?: number;
    frameHeight?: number;
    iterationOverrides?: Record<string, number>;
    token?: GateToken | null;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body" }, { status: 400 });
  }
  if (!body.graph || typeof body.graph !== "object" || typeof body.graph.nodes !== "object") {
    return Response.json({ error: "Expected { graph }" }, { status: 400 });
  }
  const report = preRunReport(body.graph, SERVER_REGISTRY, {
    ...(Array.isArray(body.seeds) ? { seeds: body.seeds as NodeId[] } : {}),
    ...(typeof body.sequenceLength === "number" ? { sequenceLength: body.sequenceLength } : {}),
    ...(typeof body.frameWidth === "number" ? { frameWidth: body.frameWidth } : {}),
    ...(typeof body.frameHeight === "number" ? { frameHeight: body.frameHeight } : {}),
    ...(body.iterationOverrides ? { iterationOverrides: body.iterationOverrides } : {}),
  });
  return Response.json({
    report,
    summary: summarise(report),
    verdict: gateAllows(report, body.token ?? null),
  }, { headers: { "cache-control": "no-store" } });
}

function stripPrefix(pathname: string, prefix: string): string {
  const rest = pathname.slice(prefix.length);
  return rest === "" || rest === "/" ? "index.html" : rest.replace(/^\//, "");
}

/** Send browser navigations to Workshop. Desk files stay at /desk/ for the iframes. */
function toWorkshop(from: URL): URL {
  const dest = new URL("/blueprint/", from);
  dest.search = "";
  for (const [k, v] of from.searchParams) {
    if (k !== "embed") dest.searchParams.set(k, v);
  }
  return dest;
}

function deskEmbed(url: URL): string | null {
  const embed = url.searchParams.get("embed");
  return embed === "1" || embed === "tools" ? embed : null;
}

Deno.serve({
  port: UI_PORT,
  hostname: "127.0.0.1",
  onListen: ({ port }) => {
    console.log(`  Ars Technic AI  http://127.0.0.1:${port}/`);
    console.log(`  Workshop        http://127.0.0.1:${port}/blueprint/`);
    console.log(`  Engine          ${BACKEND_HTTP}`);
  },
}, async (request) => {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/ws") return bridgeSocket(request);
  if (path.startsWith("/api/")) {
    const m = path.match(/^\/api\/project\/([^/]+)$/);
    const studioId = m?.[1];
    if (studioId && request.method === "GET") {
      const upstream = await proxyApi(request, url);
      if (upstream.status !== 404) return upstream;
      const studio = await readStudioProject(decodeURIComponent(studioId));
      if (studio) return Response.json(studio);
      return upstream;
    }
    return await proxyApi(request, url);
  }
  if (path.startsWith("/shared/")) {
    return await serveStatic(SHARED_DIR, path.slice("/shared/".length));
  }
  if (path === "/status") return await status();

  // These live outside /api/ on purpose: /api/* is proxied verbatim to the
  // engine, and these are this server's own. Putting them under /api would
  // mean the engine could shadow them.
  if (path === "/library" && request.method === "GET") return await serveLibrary(url);
  if (path === "/models" && request.method === "GET") return serveModels();
  if (path === "/estimate" && request.method === "POST") return await serveEstimate(request);
  if (path === "/diagnostics" && request.method === "POST") return await serveDiagnostics(request);
  {
    const m = path.match(/^\/lineage\/([^/]+)(\/query|\/blueprint)?$/);
    if (m) return await lineageRoute(request, url, decodeURIComponent(m[1]!), m[2] ?? "");
    const a = path.match(/^\/assets\/([^/]+)$/);
    if (a && request.method === "POST") return await assetRoute(request, url, decodeURIComponent(a[1]!));
  }
  if (path.startsWith("/library/")) {
    return await serveStatic(LIBRARY_DIR, path.slice("/library/".length));
  }
  if (path === "/fs/list") return await listDirectory(url);
  if (path === "/flows" && request.method === "GET") return await listFlows();
  if (path === "/flows" && request.method === "POST") return await writeFlow(request);
  if (path.startsWith("/flows/")) return await readFlow(path.slice("/flows/".length));
  if (path === "/studio/projects" && request.method === "GET") return await listStudioProjects();
  if (path === "/studio/projects" && request.method === "POST") {
    return await createStudioProject(request);
  }

  if (path === "/workshop" || path === "/workshop/" || path === "/work" || path === "/work/") {
    return Response.redirect(toWorkshop(url), 302);
  }
  if (path === "/blueprint") {
    return Response.redirect(toWorkshop(url), 302);
  }
  if (path === "/desk") {
    if (deskEmbed(url)) {
      const dest = new URL("/desk/", url);
      dest.search = url.search;
      return Response.redirect(dest, 302);
    }
    return Response.redirect(toWorkshop(url), 302);
  }
  if (path === "/desk/" && !deskEmbed(url)) {
    return Response.redirect(toWorkshop(url), 302);
  }
  if (path.startsWith("/desk/")) {
    return await serveStatic(DESK_DIR, stripPrefix(path, "/desk"));
  }
  if (path.startsWith("/blueprint/")) {
    return await serveStatic(BLUEPRINT_DIR, stripPrefix(path, "/blueprint"));
  }

  if (path === "/") return await serveStatic(HOME_DIR, "index.html");
  return await serveStatic(HOME_DIR, path.slice(1));
});
