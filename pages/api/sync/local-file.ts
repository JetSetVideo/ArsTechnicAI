/**
 * /api/sync/local-file?name=<file> — this machine's generated media (public/generated),
 * for the sync engine running in the browser.
 *
 *   HEAD      exists? + size + X-Ars-Sha256 (streamed once, cached) — lets the
 *             engine compare with the home server without moving any bytes.
 *   GET       the bytes — independent of Next's static serving, which in
 *             production only knows build-time files.
 *   PUT       write a file (X-Ars-Sha256 required), verified before it appears;
 *             an existing file is never replaced (same content → 200, else 409).
 *
 * Large transfers between machines go server-to-server instead
 * (/api/sync/transfer/push|pull), so a multi-GB video never passes through the browser.
 * Owner over trusted loopback, or a signed-in user.
 */
import { createReadStream } from 'fs';
import type { NextApiRequest, NextApiResponse } from 'next';
import { withPrincipal } from '@/lib/auth/requestAuth';
import { SHA256_RE } from '@/lib/storage/blobStore';
import { GeneratedFileError, generatedPath, generatedSha256, isGeneratedName, statGenerated, writeGenerated } from '@/lib/storage/generatedFiles';

export const config = { api: { bodyParser: false, responseLimit: false } };

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const name = Array.isArray(req.query.name) ? req.query.name[0] : req.query.name;
  if (!isGeneratedName(name)) return res.status(400).json({ error: 'Invalid file name' });

  if (req.method === 'HEAD' || req.method === 'GET') {
    const st = await statGenerated(name);
    if (!st) return res.status(404).end();
    res.setHeader('Content-Length', String(st.size));
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    if (req.method === 'HEAD') {
      const h = await generatedSha256(name);
      if (h) res.setHeader('X-Ars-Sha256', h.sha256);
      return res.status(200).end();
    }
    res.status(200);
    createReadStream(generatedPath(name)).on('error', () => res.destroy()).pipe(res);
    return;
  }

  if (req.method === 'PUT') {
    const raw = req.headers['x-ars-sha256'];
    const sha = (Array.isArray(raw) ? raw[0] : raw)?.toLowerCase();
    if (!sha || !SHA256_RE.test(sha)) return res.status(400).json({ error: 'X-Ars-Sha256 header is required' });
    try {
      const out = await writeGenerated(req, name, sha);
      return res.status(out.status === 'written' ? 201 : 200).json(out);
    } catch (err) {
      if (err instanceof GeneratedFileError) return res.status(err.status).json({ error: err.message, code: err.code });
      return res.status(500).json({ error: (err as Error).message });
    }
  }

  res.setHeader('Allow', 'GET, HEAD, PUT');
  return res.status(405).json({ error: 'Method not allowed' });
}

export default withPrincipal(handler, { allowLocal: true });
