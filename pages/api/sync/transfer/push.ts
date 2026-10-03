/**
 * POST /api/sync/transfer/push — stream one of this machine's generated files to
 * the home server, server-to-server (a multi-GB video never passes through the
 * browser). Body: { file, projectId, assetId, name?, mimeType?, metadata? }.
 *
 * The caller's Authorization (the home server's session token) is forwarded to
 * the home server only. First tries to link a blob the server already holds
 * (no bytes sent); streams the file only when it does not.
 */
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import type { NextApiRequest, NextApiResponse } from 'next';
import { withPrincipal } from '@/lib/auth/requestAuth';
import { isSafeAssetKey, isSafeId } from '@/lib/security/safePath';
import { generatedPath, generatedSha256, isGeneratedName } from '@/lib/storage/generatedFiles';
import { homeServerUrl } from '@/lib/sync/homeServerUrl';

const MIME_RE = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { file, projectId, assetId, name, mimeType, metadata } = (req.body ?? {}) as Record<string, unknown>;
  if (!isGeneratedName(file) || !isSafeId(projectId) || !isSafeAssetKey(assetId)) {
    return res.status(400).json({ error: 'Invalid file, project or asset id' });
  }
  const auth = req.headers.authorization;
  if (!auth?.toLowerCase().startsWith('bearer ')) return res.status(401).json({ error: 'Sign in to the home server to sync', code: 'NO_HOME_TOKEN' });

  const local = await generatedSha256(file);
  if (!local) return res.status(404).json({ error: 'File not on this machine', code: 'LOCAL_MISSING' });

  const headers: Record<string, string> = {
    Authorization: auth,
    'Content-Type': typeof mimeType === 'string' && MIME_RE.test(mimeType) ? mimeType : 'application/octet-stream',
    'X-Ars-Sha256': local.sha256,
    'X-Ars-Name': encodeURIComponent(typeof name === 'string' && name ? name.slice(0, 255) : file),
  };
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const meta = Buffer.from(JSON.stringify(metadata)).toString('base64url');
    if (meta.length < 10_000) headers['X-Ars-Metadata'] = meta;
  }
  const url = `${homeServerUrl(req)}/api/sync/assets/${encodeURIComponent(projectId)}/${encodeURIComponent(assetId)}`;

  try {
    // 1. Link a blob the server already has (dedupe across projects and devices).
    let remote = await fetch(url, { method: 'PUT', headers: { ...headers, 'X-Ars-Reuse': '1', 'Content-Length': '0' }, body: new Uint8Array(0) });
    let sent = 0;
    // 2. Otherwise stream the file.
    if (remote.status === 412) {
      const body = Readable.toWeb(createReadStream(generatedPath(file))) as unknown as BodyInit;
      remote = await fetch(url, { method: 'PUT', headers: { ...headers, 'Content-Length': String(local.size) }, body, duplex: 'half' } as RequestInit);
      sent = local.size;
    }
    const out = await remote.json().catch(() => ({}));
    return res.status(remote.status).json({ ...out, sha256: local.sha256, sentBytes: sent });
  } catch (err) {
    return res.status(502).json({ error: `Home server unreachable: ${(err as Error).message}`, code: 'HOME_UNREACHABLE' });
  }
}

export default withPrincipal(handler, { allowLocal: true });
