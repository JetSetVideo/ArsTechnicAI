/**
 * /api/sync/assets/:projectId/:assetId — the binary behind a project asset.
 *
 *   PUT   raw bytes. Headers: X-Ars-Sha256 (required), X-Ars-Name (URI-encoded),
 *         Content-Type, X-Ars-Metadata (base64url JSON, ≤ 8 KB). Bytes are hashed
 *         while streamed; a mismatch is rejected and nothing is stored.
 *         With an empty body and X-Ars-Reuse: 1, links an existing blob (dedupe).
 *   GET   the bytes (ETag = sha256, If-None-Match → 304).  HEAD: headers only.
 *
 * Also mirrored to OneDrive (lib/storage/oneDriveMirror) — best effort.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { withPrincipal, type Principal } from '@/lib/auth/requestAuth';
import { isSafeAssetKey, isSafeId } from '@/lib/security/safePath';
import { BlobError, blobPath, blobSize, hasBlob, openBlob, putBlob, SHA256_RE } from '@/lib/storage/blobStore';
import { mirrorAsset } from '@/lib/storage/oneDriveMirror';
import { findAsset, ownedProject, recordAsset, SyncError } from '@/services/sync/syncService';

export const config = { api: { bodyParser: false, responseLimit: false } };

const MAX_META_BYTES = 8 * 1024;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parseMetadata(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  if (raw.length > MAX_META_BYTES * 2) throw new SyncError('X-Ars-Metadata too large', 413, 'META_TOO_LARGE');
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed as Record<string, unknown>;
  } catch {
    throw new SyncError('X-Ars-Metadata must be base64url JSON', 400, 'BAD_META');
  }
}

function safeMime(raw: string | undefined): string | null {
  const v = raw?.split(';')[0].trim().toLowerCase();
  return v && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(v) ? v : null;
}

async function handler(req: NextApiRequest, res: NextApiResponse, principal: Principal) {
  if (principal.kind !== 'user') return res.status(401).json({ error: 'Sign in to sync' });
  const projectId = req.query.projectId;
  const assetId = req.query.assetId;
  if (!isSafeId(projectId) || !isSafeAssetKey(assetId)) return res.status(400).json({ error: 'Invalid project or asset id' });

  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const found = await findAsset(principal.userId, projectId, assetId);
      if (!found?.sha256 || !(await hasBlob(found.sha256))) return res.status(404).json({ error: 'Asset not found' });

      const etag = `"${found.sha256}"`;
      res.setHeader('ETag', etag);
      res.setHeader('X-Ars-Sha256', found.sha256);
      // Served bytes are user content: never let them run as a page on this origin.
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      if (req.headers['if-none-match'] === etag) return res.status(304).end();

      const size = (await blobSize(found.sha256)) ?? 0;
      res.setHeader('Content-Type', found.row.mimeType || 'application/octet-stream');
      res.setHeader('Content-Length', String(size));
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(found.row.name)}`);
      if (req.method === 'HEAD') return res.status(200).end();
      res.status(200);
      openBlob(found.sha256).on('error', () => res.destroy()).pipe(res);
      return;
    }

    if (req.method === 'PUT') {
      const sha256 = one(req.headers['x-ars-sha256'])?.toLowerCase();
      if (!sha256 || !SHA256_RE.test(sha256)) return res.status(400).json({ error: 'X-Ars-Sha256 header (hex SHA-256) is required' });
      const rawName = one(req.headers['x-ars-name']);
      let name = assetId;
      if (rawName) {
        try {
          name = decodeURIComponent(rawName).slice(0, 255) || assetId;
        } catch {
          return res.status(400).json({ error: 'X-Ars-Name must be URI-encoded' });
        }
      }
      const metadata = parseMetadata(one(req.headers['x-ars-metadata']));
      const mimeType = safeMime(one(req.headers['content-type']));

      // Ownership before reading a single byte.
      if (!(await ownedProject(principal.userId, projectId))) {
        return res.status(404).json({ error: 'Push the project before its assets', code: 'PROJECT_NOT_FOUND' });
      }

      let stored: { sha256: string; size: number; created: boolean };
      const reuse = one(req.headers['x-ars-reuse']) === '1' && Number(req.headers['content-length'] ?? 0) === 0;
      if (reuse) {
        const size = await blobSize(sha256);
        if (size === null) return res.status(412).json({ error: 'Blob not on the server — send the bytes', code: 'BLOB_MISSING' });
        stored = { sha256, size, created: false };
      } else {
        stored = await putBlob(req, { expectedSha256: sha256 });
      }

      const { project, row } = await recordAsset(principal.userId, projectId, { assetId, name, mimeType, sha256: stored.sha256, size: stored.size, metadata });
      const mirror = await mirrorAsset(projectId, project.name, {
        assetId,
        name,
        sha256: stored.sha256,
        size: stored.size,
        mimeType,
        sourcePath: blobPath(stored.sha256),
      });
      res.setHeader('ETag', `"${stored.sha256}"`);
      return res.status(200).json({ sha256: stored.sha256, size: stored.size, created: stored.created, updatedAt: row.updatedAt.getTime(), mirrored: mirror.ok && !mirror.skipped });
    }

    res.setHeader('Allow', 'GET, HEAD, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err instanceof BlobError || err instanceof SyncError) {
      // Drain what the client is still sending so it reads our answer.
      if (!req.complete) req.resume();
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error('[sync] asset route failed:', err);
    return res.status(500).json({ error: 'Asset sync failed' });
  }
}

export default withPrincipal(handler);
