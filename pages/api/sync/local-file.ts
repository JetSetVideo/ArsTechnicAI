/**
 * /api/sync/local-file?name=<file> — this machine's generated media (public/generated),
 * for the sync engine running in the browser.
 *
 *   HEAD/GET  does the file exist here (and its bytes) — independent of Next's
 *             static serving, which in production only knows build-time files.
 *   PUT       write a pulled file. X-Ars-Sha256 required; bytes are verified
 *             before the file appears (atomic rename). An existing file is never
 *             replaced: same content → 200 unchanged, different → 409.
 *
 * Owner over trusted loopback, or a signed-in user.
 */
import { createHash, randomBytes } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';
import { withPrincipal } from '@/lib/auth/requestAuth';
import { maxAssetBytes, SHA256_RE } from '@/lib/storage/blobStore';
import { resolveInside } from '@/lib/security/safePath';

export const config = { api: { bodyParser: false, responseLimit: false } };

const GENERATED_DIR = path.join(process.cwd(), 'public', 'generated');
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;

function fileHash(p: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(p).on('data', (c) => h.update(c)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const name = Array.isArray(req.query.name) ? req.query.name[0] : req.query.name;
  if (!name || !FILE_RE.test(name) || name.includes('..')) return res.status(400).json({ error: 'Invalid file name' });
  const target = resolveInside(GENERATED_DIR, name);

  if (req.method === 'HEAD' || req.method === 'GET') {
    let size: number;
    try {
      const st = await fs.stat(target);
      if (!st.isFile()) return res.status(404).end();
      size = st.size;
    } catch {
      return res.status(404).end();
    }
    res.setHeader('Content-Length', String(size));
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    if (req.method === 'HEAD') return res.status(200).end();
    res.status(200);
    createReadStream(target).on('error', () => res.destroy()).pipe(res);
    return;
  }

  if (req.method === 'PUT') {
    const sha = (Array.isArray(req.headers['x-ars-sha256']) ? req.headers['x-ars-sha256'][0] : req.headers['x-ars-sha256'])?.toLowerCase();
    if (!sha || !SHA256_RE.test(sha)) return res.status(400).json({ error: 'X-Ars-Sha256 header is required' });

    try {
      if ((await fs.stat(target)).isFile()) {
        req.resume();
        const existing = await fileHash(target);
        return existing === sha
          ? res.status(200).json({ status: 'unchanged' })
          : res.status(409).json({ error: 'A different file with this name already exists here', code: 'NAME_TAKEN' });
      }
    } catch {
      /* absent — write it */
    }

    await fs.mkdir(GENERATED_DIR, { recursive: true });
    const tmp = resolveInside(GENERATED_DIR, `.~ars-${randomBytes(6).toString('hex')}.tmp`);
    const hash = createHash('sha256');
    const max = maxAssetBytes();
    let size = 0;
    try {
      await new Promise<void>((resolve, reject) => {
        const out = createWriteStream(tmp, { mode: 0o644 });
        req.on('data', (c: Buffer) => {
          size += c.length;
          if (size > max) {
            req.destroy();
            out.destroy();
            return reject(Object.assign(new Error('File too large'), { status: 413 }));
          }
          hash.update(c);
        });
        req.on('error', reject);
        out.on('error', reject);
        out.on('finish', resolve);
        req.pipe(out);
      });
      if (hash.digest('hex') !== sha) {
        await fs.rm(tmp, { force: true });
        return res.status(422).json({ error: 'Content does not match X-Ars-Sha256', code: 'HASH_MISMATCH' });
      }
      // link() fails if the name appeared meanwhile — still never an overwrite.
      try {
        await fs.link(tmp, target);
      } catch (err) {
        await fs.rm(tmp, { force: true });
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') return res.status(409).json({ error: 'File appeared concurrently', code: 'NAME_TAKEN' });
        throw err;
      }
      await fs.rm(tmp, { force: true });
      return res.status(201).json({ status: 'written', size });
    } catch (err) {
      await fs.rm(tmp, { force: true }).catch(() => {});
      const status = (err as { status?: number }).status ?? 500;
      return res.status(status).json({ error: (err as Error).message });
    }
  }

  res.setHeader('Allow', 'GET, HEAD, PUT');
  return res.status(405).json({ error: 'Method not allowed' });
}

export default withPrincipal(handler, { allowLocal: true });
