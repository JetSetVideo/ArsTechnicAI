/**
 * /api/sync/projects/:id
 *   GET — the project's bundle as last pushed (pull).
 *   PUT — push a bundle: { name, description?, bundle, baseVersion, device? }.
 *         200 { status: created|updated|unchanged, version, hash }
 *         409 { status: conflict, server: {...} } when the server moved on since
 *             baseVersion — the client keeps both copies (lib/sync/syncEngine).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { withPrincipal, type Principal } from '@/lib/auth/requestAuth';
import { isSafeId } from '@/lib/security/safePath';
import { pullProject, pushProject, SyncError } from '@/services/sync/syncService';

// Bundles carry canvas items, which can embed base64 images.
export const config = { api: { bodyParser: { sizeLimit: '100mb' } } };

async function handler(req: NextApiRequest, res: NextApiResponse, principal: Principal) {
  if (principal.kind !== 'user') return res.status(401).json({ error: 'Sign in to sync' });
  const id = req.query.id;
  if (!isSafeId(id)) return res.status(400).json({ error: 'Invalid project id' });

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await pullProject(principal.userId, id));
    }

    if (req.method === 'PUT') {
      const body = req.body ?? {};
      const { name, description, bundle, baseVersion, device } = body as Record<string, unknown>;
      if (typeof name !== 'string') return res.status(400).json({ error: 'name is required' });
      if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) return res.status(400).json({ error: 'bundle must be an object' });
      if (baseVersion !== null && typeof baseVersion !== 'number') return res.status(400).json({ error: 'baseVersion must be a number or null' });
      if (description !== undefined && description !== null && typeof description !== 'string') return res.status(400).json({ error: 'description must be a string' });

      const result = await pushProject(principal.userId, {
        projectId: id,
        name,
        description: description as string | null | undefined,
        bundle: bundle as Record<string, unknown>,
        baseVersion: baseVersion as number | null,
        device: typeof device === 'string' ? device : undefined,
      });
      return res.status(result.status === 'conflict' ? 409 : 200).json(result);
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err instanceof SyncError) return res.status(err.status).json({ error: err.message, code: err.code });
    console.error('[sync] project route failed:', err);
    return res.status(500).json({ error: 'Sync failed' });
  }
}

export default withPrincipal(handler);
