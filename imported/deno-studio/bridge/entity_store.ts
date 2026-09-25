/**
 * entity_store.ts — entities and their material on disk.
 *
 * Same rule as lineage and assets, for the same reason: **a save is a new
 * version, never a replacement**. A character's description is exactly the kind
 * of text someone rewrites at midnight and wants back in the morning, and the
 * drawings attached to it are original work that no edit should be able to
 * destroy.
 *
 * Layout, under the workspace:
 *
 *     entities/<id>/entity.v1.json      the first save
 *     entities/<id>/entity.v2.json      …and every one after it
 *     entities/<id>/media/v1/<file>     one directory claimed per upload
 *
 * Reading takes the highest version. Nothing here deletes.
 */

import {
  applyEdit,
  attachMedia,
  createEntity,
  type Entity,
  type EntityDraft,
  type EntityMedia,
  type MediaKind,
  validateDraft,
} from "../core/entities.ts";

const ENTITY_FILE = /^entity\.v(\d+)\.json$/;
const VERSION_DIR = /^v(\d+)$/;

export type StoreResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly status: number; readonly reason: string };

function entitiesRoot(workspace: string): string {
  return `${workspace}/entities`;
}

/** An id is one path segment of a known shape — never a path. */
function safeId(id: string): string | null {
  return /^(character|place|prop)\.[a-z0-9-]{1,60}$/.test(id) ? id : null;
}

async function maxVersion(dir: string, pattern: RegExp, want: "file" | "dir"): Promise<number> {
  let max = 0;
  try {
    for await (const entry of Deno.readDir(dir)) {
      if (want === "file" ? !entry.isFile : !entry.isDirectory) continue;
      const m = entry.name.match(pattern);
      if (m) max = Math.max(max, Number(m[1]));
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  return max;
}

async function readEntity(workspace: string, id: string): Promise<Entity | null> {
  const dir = `${entitiesRoot(workspace)}/${id}`;
  const version = await maxVersion(dir, ENTITY_FILE, "file");
  if (version === 0) return null;
  try {
    return JSON.parse(await Deno.readTextFile(`${dir}/entity.v${version}.json`)) as Entity;
  } catch {
    return null;
  }
}

async function writeEntity(workspace: string, entity: Entity): Promise<number> {
  const dir = `${entitiesRoot(workspace)}/${entity.id}`;
  await Deno.mkdir(dir, { recursive: true });
  const next = (await maxVersion(dir, ENTITY_FILE, "file")) + 1;
  await Deno.writeTextFile(
    `${dir}/entity.v${next}.json`,
    JSON.stringify(entity, null, 2) + "\n",
    { createNew: true },
  );
  return next;
}

/** Every entity, newest first. Unreadable ones are skipped, never thrown. */
export async function listEntities(workspace: string): Promise<Entity[]> {
  const out: Entity[] = [];
  try {
    for await (const entry of Deno.readDir(entitiesRoot(workspace))) {
      if (!entry.isDirectory || !safeId(entry.name)) continue;
      const entity = await readEntity(workspace, entry.name);
      if (entity) out.push(entity);
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getEntity(workspace: string, id: string): Promise<Entity | null> {
  const safe = safeId(id);
  return safe ? await readEntity(workspace, safe) : null;
}

export async function saveEntity(
  workspace: string,
  draft: EntityDraft,
  id?: string,
): Promise<StoreResult<{ entity: Entity; version: number }>> {
  const problems = validateDraft(draft);
  if (problems.length > 0) return { ok: false, status: 400, reason: problems.join(" ") };

  let entity: Entity;
  if (id) {
    const safe = safeId(id);
    if (!safe) return { ok: false, status: 403, reason: "Bad entity id." };
    const existing = await readEntity(workspace, safe);
    if (!existing) return { ok: false, status: 404, reason: `No entity ${id}.` };
    entity = applyEdit(existing, draft);
  } else {
    entity = createEntity(draft);
  }
  const version = await writeEntity(workspace, entity);
  return { ok: true, value: { entity, version } };
}

const EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/mp4": "m4a",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
};

function mediaKindFor(contentType: string): MediaKind | null {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  if (contentType === "application/pdf" || contentType.startsWith("text/")) return "document";
  return null;
}

/**
 * Attach one file: a drawing from the canvas, a photograph, a clip.
 *
 * Every upload claims its own `media/v{N}` directory, so two files with the
 * same name never collide and nothing already attached can be replaced.
 */
export async function addMedia(
  workspace: string,
  id: string,
  input: {
    bytes: Uint8Array;
    contentType: string;
    filename?: string;
    caption?: string;
    drawn?: boolean;
  },
): Promise<StoreResult<{ entity: Entity; media: EntityMedia }>> {
  const safe = safeId(id);
  if (!safe) return { ok: false, status: 403, reason: "Bad entity id." };
  const entity = await readEntity(workspace, safe);
  if (!entity) return { ok: false, status: 404, reason: `No entity ${id}.` };
  if (input.bytes.byteLength === 0) return { ok: false, status: 400, reason: "Empty file." };

  const type = input.contentType.split(";")[0]!.trim().toLowerCase();
  const kind = mediaKindFor(type);
  if (!kind) {
    return {
      ok: false,
      status: 415,
      reason: `${type || "that file"} is not a kind of material this holds ` +
        "(images, video, audio, PDF or text).",
    };
  }

  const dir = `${entitiesRoot(workspace)}/${safe}/media`;
  await Deno.mkdir(dir, { recursive: true });
  let version = (await maxVersion(dir, VERSION_DIR, "dir")) + 1;
  const extension = EXTENSION[type] ?? "bin";
  const stem = (input.filename ?? (input.drawn ? "drawing" : "file"))
    .split(/[\\/]/).pop()!
    .replace(/\.[^.]*$/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, 60) || "file";

  for (let attempt = 0; attempt < 16; attempt++, version++) {
    try {
      await Deno.mkdir(`${dir}/v${version}`);
    } catch (error) {
      if (error instanceof Deno.errors.AlreadyExists) continue;
      throw error;
    }
    const relative = `entities/${safe}/media/v${version}/${stem}.${extension}`;
    await Deno.writeFile(`${workspace}/${relative}`, input.bytes, { createNew: true });
    const media: EntityMedia = {
      id: `m${version}`,
      kind: input.drawn && kind === "image" ? "drawing" : kind,
      path: relative,
      ...(input.caption ? { caption: input.caption.slice(0, 200) } : {}),
      addedAt: Date.now(),
      bytes: input.bytes.byteLength,
    };
    const updated = attachMedia(entity, media);
    await writeEntity(workspace, updated);
    return { ok: true, value: { entity: updated, media } };
  }
  return { ok: false, status: 409, reason: "Could not claim a media directory." };
}

/** Resolve a media path for serving. Refuses anything outside `entities/`. */
export function mediaPath(workspace: string, relative: string): string | null {
  const clean = decodeURIComponent(relative).replace(/\\/g, "/");
  if (clean.includes("\0") || clean.includes("..")) return null;
  if (!clean.startsWith("entities/")) return null;
  return `${workspace}/${clean}`;
}
