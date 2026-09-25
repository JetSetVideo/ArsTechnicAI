/**
 * lineage_store.ts — putting lineage and assets on disk without ever
 * overwriting either.
 *
 * Two write paths, one rule:
 *
 *   - **Lineage** is saved as `lineage/lineage.v{N}.json`. Each save is a new
 *     file, opened with `createNew`, so a racing second writer fails instead of
 *     clobbering. A save is also refused unless it *extends* the previous
 *     version: every asset, edge and parameter record already on disk must be
 *     present and unchanged. A client bug that dropped a node would otherwise
 *     be persisted as history.
 *   - **Assets** go to `assets/v{N}/<name>`, a fresh `v{N}` directory per write.
 *     Same `createNew` guarantee; the name is sanitised, never a path.
 *
 * Nothing here deletes. There is no function to.
 */

import { HybridLineage, type HybridSnapshot } from "../core/hybrid.ts";
import { canonicalise } from "../core/hash.ts";

const LINEAGE_FILE = /^lineage\.v(\d+)\.json$/;
const VERSION_DIR = /^v(\d+)$/;

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

export interface LoadedLineage {
  readonly version: number;
  readonly snapshot: HybridSnapshot | null;
}

export async function loadLatestLineage(projectDir: string): Promise<LoadedLineage> {
  const dir = `${projectDir}/lineage`;
  const version = await maxVersion(dir, LINEAGE_FILE, "file");
  if (version === 0) return { version: 0, snapshot: null };
  const text = await Deno.readTextFile(`${dir}/lineage.v${version}.json`);
  return { version, snapshot: JSON.parse(text) as HybridSnapshot };
}

/**
 * Why `next` is not a pure extension of `prev`, or null when it is.
 * Compared canonically, so key order in a client's JSON does not matter.
 */
export function extensionProblem(prev: HybridSnapshot, next: HybridSnapshot): string | null {
  const nodes = new Map(next.nodes.map((n) => [n.id, canonicalise(n)]));
  for (const n of prev.nodes) {
    const now = nodes.get(n.id);
    if (now === undefined) return `Asset ${n.id} is missing; assets cannot be removed.`;
    if (now !== canonicalise(n)) return `Asset ${n.id} was modified; derive a new asset instead.`;
  }
  const edges = new Set(next.edges.map((e) => canonicalise(e)));
  for (const e of prev.edges) {
    if (!edges.has(canonicalise(e))) return `Edge ${e.from} → ${e.to} is missing or changed.`;
  }
  const prevCols = prev.columns;
  const nextCols = next.columns;
  if (nextCols.rows < prevCols.rows) return "Parameter records were removed.";
  for (const [field, col] of Object.entries(prevCols.columns)) {
    const now = nextCols.columns[field];
    if (!now) return `Parameter column ${field} was removed.`;
    for (let r = 0; r < prevCols.rows; r++) {
      if ((col.values[r] ?? null) !== (now.values[r] ?? null)) {
        return `Parameter record ${prevCols.columns.record_id?.values[r]} changed field ${field}.`;
      }
    }
  }
  for (const [field, col] of Object.entries(nextCols.columns)) {
    if (prevCols.columns[field]) continue;
    for (let r = 0; r < prevCols.rows; r++) {
      if ((col.values[r] ?? null) !== null) {
        return `Parameter record ${prevCols.columns.record_id?.values[r]} gained field ${field}.`;
      }
    }
  }
  return null;
}

export type SaveResult =
  | { readonly ok: true; readonly version: number; readonly path: string }
  | { readonly ok: false; readonly status: number; readonly reason: string };

export async function saveLineage(projectDir: string, snapshot: unknown): Promise<SaveResult> {
  let parsed: HybridLineage;
  try {
    parsed = HybridLineage.fromSnapshot(snapshot as HybridSnapshot);
  } catch (error) {
    return {
      ok: false,
      status: 400,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
  const normalised = parsed.snapshot();
  const { version, snapshot: prev } = await loadLatestLineage(projectDir);
  if (prev) {
    const problem = extensionProblem(prev, normalised);
    if (problem) return { ok: false, status: 409, reason: problem };
    if (canonicalise(prev) === canonicalise(normalised)) {
      return { ok: true, version, path: `lineage/lineage.v${version}.json` };
    }
  }
  const dir = `${projectDir}/lineage`;
  await Deno.mkdir(dir, { recursive: true });
  const next = version + 1;
  const rel = `lineage/lineage.v${next}.json`;
  try {
    await Deno.writeTextFile(`${projectDir}/${rel}`, JSON.stringify(normalised, null, 2) + "\n", {
      createNew: true,
    });
  } catch (error) {
    if (error instanceof Deno.errors.AlreadyExists) {
      return { ok: false, status: 409, reason: "Another save landed first. Reload and retry." };
    }
    throw error;
  }
  return { ok: true, version: next, path: rel };
}

/** A filename safe to place inside a version directory. */
export function sanitiseAssetName(name: string): string | null {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 120);
  return clean.length > 0 ? clean : null;
}

export async function writeVersionedAsset(
  projectDir: string,
  name: string,
  bytes: Uint8Array,
): Promise<SaveResult> {
  const safe = sanitiseAssetName(name);
  if (!safe) return { ok: false, status: 400, reason: "That asset name has no usable characters." };
  const root = `${projectDir}/assets`;
  await Deno.mkdir(root, { recursive: true });
  // Claim a version directory atomically: mkdir without `recursive` fails if it exists.
  let n = (await maxVersion(root, VERSION_DIR, "dir")) + 1;
  for (let attempt = 0; attempt < 16; attempt++, n++) {
    try {
      await Deno.mkdir(`${root}/v${n}`);
    } catch (error) {
      if (error instanceof Deno.errors.AlreadyExists) continue;
      throw error;
    }
    const rel = `assets/v${n}/${safe}`;
    await Deno.writeFile(`${projectDir}/${rel}`, bytes, { createNew: true });
    return { ok: true, version: n, path: rel };
  }
  return { ok: false, status: 409, reason: "Could not claim a version directory." };
}
