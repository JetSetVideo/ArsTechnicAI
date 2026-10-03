/**
 * This machine's generated media (public/generated) as seen by device sync.
 *
 * - names are plain file names (no separators, no "..")
 * - hashes are computed by streaming and cached by (size, mtime), so a 4 GB
 *   video is read once, not on every sync
 * - writes are verified before the file appears (temp file + link) and never
 *   replace an existing file with different content
 */
import { createHash, randomBytes } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import type { Readable } from 'stream';
import { resolveInside } from '@/lib/security/safePath';
import { maxAssetBytes } from '@/lib/storage/blobStore';

export function generatedDir(): string {
  // ARS_GENERATED_DIR is a test hook only: the app, Next's static serving and the
  // generators all use public/generated.
  return process.env.ARS_GENERATED_DIR || path.join(process.cwd(), 'public', 'generated');
}

const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;

export function isGeneratedName(name: unknown): name is string {
  return typeof name === 'string' && FILE_RE.test(name) && !name.includes('..');
}

export function generatedPath(name: string): string {
  return resolveInside(generatedDir(), name);
}

export class GeneratedFileError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = 'GeneratedFileError';
  }
}

const hashCache = new Map<string, { size: number; mtimeMs: number; sha256: string }>();

export async function statGenerated(name: string): Promise<{ size: number; mtimeMs: number } | null> {
  try {
    const st = await fs.stat(generatedPath(name));
    return st.isFile() ? { size: st.size, mtimeMs: st.mtimeMs } : null;
  } catch {
    return null;
  }
}

export function sha256OfFile(p: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(p).on('data', (c) => h.update(c)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}

/** SHA-256 of a generated file, streamed once and cached while size+mtime are unchanged. */
export async function generatedSha256(name: string): Promise<{ sha256: string; size: number } | null> {
  const st = await statGenerated(name);
  if (!st) return null;
  const p = generatedPath(name);
  const hit = hashCache.get(p);
  if (hit && hit.size === st.size && hit.mtimeMs === st.mtimeMs) return { sha256: hit.sha256, size: st.size };
  const sha256 = await sha256OfFile(p);
  hashCache.set(p, { size: st.size, mtimeMs: st.mtimeMs, sha256 });
  if (hashCache.size > 5000) hashCache.delete(hashCache.keys().next().value as string);
  return { sha256, size: st.size };
}

/**
 * Stream `source` into public/generated/<name>.
 * 'unchanged' when the same content is already there; throws NAME_TAKEN when a
 * different file holds the name, HASH_MISMATCH / TOO_LARGE on bad input.
 */
export async function writeGenerated(source: Readable, name: string, expectedSha256: string): Promise<{ status: 'written' | 'unchanged'; size: number }> {
  const target = generatedPath(name);
  const existing = await generatedSha256(name);
  if (existing) {
    source.resume();
    if (existing.sha256 === expectedSha256) return { status: 'unchanged', size: existing.size };
    throw new GeneratedFileError('A different file with this name already exists here', 409, 'NAME_TAKEN');
  }

  await fs.mkdir(generatedDir(), { recursive: true });
  const tmp = resolveInside(generatedDir(), `.~ars-${randomBytes(6).toString('hex')}.tmp`);
  const hash = createHash('sha256');
  const max = maxAssetBytes();
  let size = 0;
  try {
    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(tmp, { mode: 0o644 });
      source.on('data', (c: Buffer) => {
        size += c.length;
        if (size > max) {
          source.destroy();
          out.destroy();
          return reject(new GeneratedFileError('File too large', 413, 'TOO_LARGE'));
        }
        hash.update(c);
      });
      source.on('error', reject);
      out.on('error', reject);
      out.on('finish', resolve);
      source.pipe(out);
    });
    if (hash.digest('hex') !== expectedSha256) throw new GeneratedFileError('Content does not match the declared SHA-256', 422, 'HASH_MISMATCH');
    try {
      await fs.link(tmp, target); // fails if the name appeared meanwhile — still never an overwrite
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') throw new GeneratedFileError('File appeared concurrently', 409, 'NAME_TAKEN');
      throw err;
    }
    return { status: 'written', size };
  } finally {
    await fs.rm(tmp, { force: true }).catch(() => {});
  }
}
