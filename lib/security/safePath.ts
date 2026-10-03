/**
 * Path guards for routes that build file names from request input.
 *
 * `canvas-${projectId}.json` with projectId = "x/../../../anything" used to
 * resolve outside .ars-data (proven: an unauthenticated POST wrote
 * /tmp/ars-poc-*.json). Every id that becomes part of a path goes through
 * isSafeId, and every final path through resolveInside.
 */
import path from 'path';

/** Ids are uuids, cuids or slugs: letters, digits, '-' and '_' — no dots, no separators. */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function isSafeId(id: unknown): id is string {
  return typeof id === 'string' && SAFE_ID.test(id);
}

export class UnsafePathError extends Error {
  constructor(message = 'Path escapes its base directory') {
    super(message);
    this.name = 'UnsafePathError';
  }
}

/** Resolve `parts` under `base` and refuse anything that lands outside it. */
export function resolveInside(base: string, ...parts: string[]): string {
  const root = path.resolve(base);
  const target = path.resolve(root, ...parts);
  if (target !== root && !target.startsWith(root + path.sep)) throw new UnsafePathError();
  return target;
}

/**
 * Asset keys (e.g. "disk-gen_portrait_2026-07-01T12-45-13.png") may contain dots.
 * They are only ever database keys and URL segments — never file paths (blobs are
 * named by hash) — but still exclude separators and "..".
 */
const SAFE_ASSET_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;

export function isSafeAssetKey(id: unknown): id is string {
  return typeof id === 'string' && SAFE_ASSET_KEY.test(id) && !id.includes('..');
}
