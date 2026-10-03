/**
 * Content-addressed blob store for synced assets.
 *
 *   <ARS_STORAGE_DIR>/blobs/<first 2 hex>/<sha256>
 *
 * - Bytes are streamed to a temp file while hashed; the blob only appears under
 *   its final name (atomic rename) once the SHA-256 matches what the client
 *   declared. A truncated or corrupted upload never becomes a blob.
 * - Identical files are stored once, however many projects reference them.
 * - Blobs are never overwritten or deleted by the sync API.
 */
import { createHash, randomBytes } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import type { Readable } from 'stream';

export const SHA256_RE = /^[a-f0-9]{64}$/;

export function storageRoot(env: NodeJS.ProcessEnv = process.env): string {
  return path.resolve(env.ARS_STORAGE_DIR || path.join(process.cwd(), 'storage'));
}

export function maxAssetBytes(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.ARS_MAX_ASSET_BYTES);
  return Number.isFinite(n) && n > 0 ? n : 2 * 1024 * 1024 * 1024; // 2 GiB
}

export class BlobError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = 'BlobError';
  }
}

export function blobPath(sha256: string, root = storageRoot()): string {
  if (!SHA256_RE.test(sha256)) throw new BlobError('Invalid sha256', 400, 'BAD_HASH');
  return path.join(root, 'blobs', sha256.slice(0, 2), sha256);
}

export async function hasBlob(sha256: string, root = storageRoot()): Promise<boolean> {
  try {
    return (await fs.stat(blobPath(sha256, root))).isFile();
  } catch {
    return false;
  }
}

export async function blobSize(sha256: string, root = storageRoot()): Promise<number | null> {
  try {
    return (await fs.stat(blobPath(sha256, root))).size;
  } catch {
    return null;
  }
}

export function openBlob(sha256: string, root = storageRoot()) {
  return createReadStream(blobPath(sha256, root));
}

/**
 * Stream `source` into the store. Resolves with the verified hash and size, or
 * rejects (and leaves nothing behind) on a size overrun or hash mismatch.
 */
export async function putBlob(
  source: Readable,
  opts: { expectedSha256: string; maxBytes?: number; root?: string }
): Promise<{ sha256: string; size: number; created: boolean }> {
  const root = opts.root ?? storageRoot();
  const max = opts.maxBytes ?? maxAssetBytes();
  const expected = opts.expectedSha256.toLowerCase();
  if (!SHA256_RE.test(expected)) throw new BlobError('X-Ars-Sha256 must be a hex SHA-256', 400, 'BAD_HASH');

  const tmpDir = path.join(root, 'tmp');
  await fs.mkdir(tmpDir, { recursive: true, mode: 0o700 });
  const tmp = path.join(tmpDir, `${randomBytes(12).toString('hex')}.part`);

  const hash = createHash('sha256');
  let size = 0;
  try {
    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(tmp, { mode: 0o600 });
      const fail = (err: Error) => {
        source.unpipe(out);
        out.destroy();
        source.destroy();
        reject(err);
      };
      source.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > max) return fail(new BlobError(`Asset exceeds ${max} bytes`, 413, 'TOO_LARGE'));
        hash.update(chunk);
      });
      source.on('error', fail);
      out.on('error', fail);
      out.on('finish', resolve);
      source.pipe(out);
    });

    const actual = hash.digest('hex');
    if (actual !== expected) {
      throw new BlobError(`Content hash ${actual} does not match declared ${expected}`, 422, 'HASH_MISMATCH');
    }

    const final = blobPath(actual, root);
    if (await hasBlob(actual, root)) {
      await fs.rm(tmp, { force: true });
      return { sha256: actual, size, created: false };
    }
    await fs.mkdir(path.dirname(final), { recursive: true, mode: 0o700 });
    await fs.rename(tmp, final);
    return { sha256: actual, size, created: true };
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}
