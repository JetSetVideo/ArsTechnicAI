/**
 * GET /api/sync/manifest — every project this user owns on the home server, with
 * its bundle version/hash and its assets' hashes. Clients diff this against
 * their local state to decide what to push and pull (lib/sync/syncEngine).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { withPrincipal, type Principal } from '@/lib/auth/requestAuth';
import { getManifest } from '@/services/sync/syncService';

async function handler(req: NextApiRequest, res: NextApiResponse, principal: Principal) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (principal.kind !== 'user') return res.status(401).json({ error: 'Sign in to sync' });
  const projects = await getManifest(principal.userId);
  res.setHeader('X-Ars-Server-Time', String(Date.now()));
  return res.status(200).json({ serverTime: Date.now(), projects });
}

// Sync is per account: a signed-in user only (never loopback trust).
export default withPrincipal(handler);
