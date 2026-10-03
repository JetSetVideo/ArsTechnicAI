/**
 * POST /api/sync/transfer/pull — stream a project file from the home server into
 * this machine's public/generated, server-to-server. Body: { file, projectId, assetId }.
 * Verified against the server's SHA-256 before it appears; an existing file is
 * never replaced (same content → unchanged, different → 409).
 */
import { Readable } from 'stream';
import type { NextApiRequest, NextApiResponse } from 'next';
import { withPrincipal } from '@/lib/auth/requestAuth';
import { isSafeAssetKey, isSafeId } from '@/lib/security/safePath';
import { SHA256_RE } from '@/lib/storage/blobStore';
import { GeneratedFileError, isGeneratedName, writeGenerated } from '@/lib/storage/generatedFiles';
import { homeServerUrl } from '@/lib/sync/homeServerUrl';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { file, projectId, assetId } = (req.body ?? {}) as Record<string, unknown>;
  if (!isGeneratedName(file) || !isSafeId(projectId) || !isSafeAssetKey(assetId)) {
    return res.status(400).json({ error: 'Invalid file, project or asset id' });
  }
  const auth = req.headers.authorization;
  if (!auth?.toLowerCase().startsWith('bearer ')) return res.status(401).json({ error: 'Sign in to the home server to sync', code: 'NO_HOME_TOKEN' });

  let remote: Response;
  try {
    remote = await fetch(`${homeServerUrl(req)}/api/sync/assets/${encodeURIComponent(projectId)}/${encodeURIComponent(assetId)}`, { headers: { Authorization: auth } });
  } catch (err) {
    return res.status(502).json({ error: `Home server unreachable: ${(err as Error).message}`, code: 'HOME_UNREACHABLE' });
  }
  if (!remote.ok || !remote.body) {
    await remote.body?.cancel().catch(() => {});
    return res.status(remote.status).json({ error: `Home server answered ${remote.status}` });
  }
  const sha = remote.headers.get('x-ars-sha256')?.toLowerCase();
  if (!sha || !SHA256_RE.test(sha)) {
    await remote.body.cancel().catch(() => {});
    return res.status(502).json({ error: 'Home server did not declare the file hash' });
  }
  try {
    const out = await writeGenerated(Readable.fromWeb(remote.body as import('stream/web').ReadableStream), file, sha);
    return res.status(out.status === 'written' ? 201 : 200).json({ ...out, sha256: sha });
  } catch (err) {
    if (err instanceof GeneratedFileError) return res.status(err.status).json({ error: err.message, code: err.code });
    return res.status(500).json({ error: (err as Error).message });
  }
}

export default withPrincipal(handler, { allowLocal: true });
