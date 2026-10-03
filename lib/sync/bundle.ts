/**
 * The unit of project sync, shared by the server (services/sync) and the client
 * engine (lib/sync/syncEngine): what a project *is* on disk in .ars-data.
 *
 *   canvas    ← canvas-<id>.json
 *   pipeline  ← pipeline-<id>-draft.json
 *   fileState ← filestate-<id>.json   (the file tree, incl. projectAssets)
 *
 * Content identity is a SHA-256 over a canonical JSON form (sorted keys) of only
 * what the disk format keeps (see pages/api/workspace/save.ts):
 *   canvas    → viewport, items
 *   pipeline  → nodes, edges, viewport, collapsedStages, scenes, paramTemplates
 *   fileState → everything except its identity stamps
 * Stamps (savedAt, projectId, projectName) change on every save or are added by
 * the save itself; hashing them made a freshly pulled copy look different from
 * the server copy it came from, and two devices that merely saved look in conflict.
 */
export interface SyncBundle {
  canvas?: unknown;
  pipeline?: unknown;
  fileState?: unknown;
}

export const SYNC_FORMAT = 'ars-sync-1' as const;

/** How a bundle is stored in ProjectWorkspaceState.state. */
export interface StoredState {
  format: typeof SYNC_FORMAT;
  hash: string;
  bundle: SyncBundle;
  device?: string;
  pushedAt: string;
}

const STAMPS = new Set(['savedAt', 'projectId', 'projectName']);
const CANVAS_KEYS = ['viewport', 'items'];
const PIPELINE_KEYS = ['nodes', 'edges', 'viewport', 'collapsedStages', 'scenes', 'paramTemplates'];

function pick(part: unknown, keys: string[]): unknown {
  if (!part || typeof part !== 'object' || Array.isArray(part)) return part ?? null;
  const src = part as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (src[k] !== undefined && src[k] !== null) out[k] = src[k];
  return out;
}

function withoutStamps(part: unknown): unknown {
  if (!part || typeof part !== 'object' || Array.isArray(part)) return part ?? null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(part as Record<string, unknown>)) {
    if (!STAMPS.has(k) && v !== null) out[k] = v;
  }
  return out;
}

/** Deterministic JSON: object keys sorted at every depth; undefined dropped. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value === undefined ? null : value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => (v === undefined ? 'null' : canonicalJson(v))).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/** The string that is hashed — identical on Node and in the browser. */
export function bundleDigestInput(bundle: SyncBundle): string {
  return canonicalJson({
    canvas: bundle.canvas ? pick(bundle.canvas, CANVAS_KEYS) : null,
    pipeline: bundle.pipeline ? pick(bundle.pipeline, PIPELINE_KEYS) : null,
    fileState: bundle.fileState ? withoutStamps(bundle.fileState) : null,
  });
}

export function isStoredState(v: unknown): v is StoredState {
  return !!v && typeof v === 'object' && (v as StoredState).format === SYNC_FORMAT && typeof (v as StoredState).hash === 'string';
}

/** Files under /generated/ that a bundle's file tree points at (the binaries to sync). */
export interface BundleAssetRef {
  assetId: string;
  name: string;
  /** Public URL path, e.g. /generated/gen_x.png */
  urlPath: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

const GENERATED_PREFIX = '/generated/';

export function assetRefsOf(bundle: SyncBundle): BundleAssetRef[] {
  const fs = bundle.fileState as { projectAssets?: unknown } | undefined;
  const pairs = Array.isArray(fs?.projectAssets) ? (fs!.projectAssets as unknown[]) : [];
  const seen = new Set<string>();
  const refs: BundleAssetRef[] = [];
  for (const pair of pairs) {
    const asset = Array.isArray(pair) ? pair[1] : pair;
    if (!asset || typeof asset !== 'object') continue;
    const a = asset as { id?: unknown; name?: unknown; thumbnail?: unknown; path?: unknown; type?: unknown; metadata?: unknown };
    const url = [a.thumbnail, a.path].find((v): v is string => typeof v === 'string' && v.startsWith(GENERATED_PREFIX));
    if (typeof a.id !== 'string' || !url) continue;
    const file = url.slice(GENERATED_PREFIX.length).split(/[?#]/)[0];
    // Only plain file names directly under /generated/ — never ../ or sub-paths.
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/.test(file) || file.includes('..')) continue;
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    refs.push({
      assetId: a.id,
      name: typeof a.name === 'string' && a.name ? a.name : file,
      urlPath: GENERATED_PREFIX + file,
      metadata: a.metadata && typeof a.metadata === 'object' ? (a.metadata as Record<string, unknown>) : undefined,
    });
  }
  return refs;
}
