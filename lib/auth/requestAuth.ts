/**
 * One way to answer "who is calling?" for every API route.
 *
 * Principals:
 *   - { kind: 'user' }  — a Bearer JWT issued by /api/auth/* (the session the UI holds),
 *                         or, as a fallback, a NextAuth session cookie.
 *   - { kind: 'local' } — the owner of this machine talking to their own server over
 *                         loopback. Lets the offline Mac keep saving to its own disk
 *                         without a reachable auth server. Never granted to:
 *                           · anything that came through a proxy (nginx, a Cursor port
 *                             forward) — those add X-Forwarded-For / X-Real-IP;
 *                           · a Host other than localhost (DNS rebinding);
 *                           · a cross-site browser request (CSRF from another tab).
 *
 * ARS_TRUST_LOOPBACK: 'auto' (default — on unless NODE_ENV=production) | '1' | '0'.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '@/lib/auth/jwt';

export type UserPrincipal = {
  kind: 'user';
  userId: string;
  email: string;
  roles: string[];
  /** Highest role, by ROLE_RANK. */
  role: string;
  via: 'jwt' | 'nextauth';
};
export type LocalPrincipal = { kind: 'local' };
export type Principal = UserPrincipal | LocalPrincipal;

export const ROLE_RANK = ['SUPERADMIN', 'ADMIN', 'CREATOR', 'USER', 'VIEWER'] as const;

export function highestRole(roles: string[]): string {
  return ROLE_RANK.find((r) => roles.includes(r)) ?? roles[0] ?? 'USER';
}

export function hasAtLeast(roles: string[], required: string): boolean {
  const need = ROLE_RANK.indexOf(required as (typeof ROLE_RANK)[number]);
  if (need === -1) return roles.includes(required);
  return roles.some((r) => {
    const rank = ROLE_RANK.indexOf(r as (typeof ROLE_RANK)[number]);
    return rank !== -1 && rank <= need;
  });
}

// ── Loopback trust ───────────────────────────────────────────────────────────

const LOOPBACK_ADDRS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
// Headers only a proxy adds. Next itself fills x-forwarded-for/-host with the
// socket address and Host when absent (base-server.js `??=`), so those two are
// compared against the socket instead of rejected outright.
const PROXY_ONLY_HEADERS = ['x-real-ip', 'forwarded', 'cf-connecting-ip', 'x-client-ip'];

type HeaderBag = Record<string, string | string[] | undefined>;
export interface LoopbackInput {
  remoteAddress?: string | null;
  headers: HeaderBag;
}

function header(h: HeaderBag, name: string): string | undefined {
  const v = h[name];
  return Array.isArray(v) ? v[0] : v;
}

function hostnameOf(hostHeader: string): string {
  const h = hostHeader.trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(0, h.indexOf(']') + 1);
  return h.split(':')[0];
}

export function loopbackTrustEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = (env.ARS_TRUST_LOOPBACK || 'auto').toLowerCase();
  if (flag === '1' || flag === 'true') return true;
  if (flag === '0' || flag === 'false') return false;
  return env.NODE_ENV !== 'production';
}

/** Pure check, unit-tested in tests/lib/requestAuth.test.ts. */
export function isTrustedLoopback(input: LoopbackInput): boolean {
  if (!input.remoteAddress || !LOOPBACK_ADDRS.has(input.remoteAddress)) return false;
  if (PROXY_ONLY_HEADERS.some((name) => header(input.headers, name) !== undefined)) return false;

  const host = header(input.headers, 'host');
  if (!host || !LOOPBACK_HOSTS.has(hostnameOf(host))) return false;

  const xff = header(input.headers, 'x-forwarded-for');
  if (xff !== undefined && xff.trim() !== input.remoteAddress) return false;
  const xfh = header(input.headers, 'x-forwarded-host');
  if (xfh !== undefined && xfh.trim().toLowerCase() !== host.trim().toLowerCase()) return false;

  const site = header(input.headers, 'sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;

  const origin = header(input.headers, 'origin');
  if (origin !== undefined) {
    if (origin === 'null') return false;
    try {
      const o = new URL(origin);
      if (!LOOPBACK_HOSTS.has(o.hostname.toLowerCase()) && !LOOPBACK_HOSTS.has(`[${o.hostname}]`)) return false;
      if (o.host.toLowerCase() !== host.trim().toLowerCase()) return false;
    } catch {
      return false;
    }
  }
  return true;
}

// ── Account status (bans take effect without waiting for token expiry) ──────

const STATUS_TTL_MS = 30_000;
const statusCache = new Map<string, { ok: boolean; at: number }>();

async function accountIsActive(userId: string): Promise<boolean> {
  const hit = statusCache.get(userId);
  if (hit && Date.now() - hit.at < STATUS_TTL_MS) return hit.ok;
  try {
    const { prisma } = await import('@/lib/prisma');
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true, isBanned: true } });
    const ok = !!u && u.isActive && !u.isBanned;
    statusCache.set(userId, { ok, at: Date.now() });
    if (statusCache.size > 1000) statusCache.delete(statusCache.keys().next().value as string);
    return ok;
  } catch (err) {
    // Database unreachable: the signature already proves we issued the token.
    // Prefer availability; revocation resumes as soon as the database is back.
    console.warn('[auth] account status check skipped (database unavailable):', (err as Error).message);
    return true;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface AuthOptions {
  /** Accept the machine owner over trusted loopback (disk-only routes). */
  allowLocal?: boolean;
  /** Minimum role for user principals (local principals are the owner). */
  role?: string;
}

function bearer(req: NextApiRequest): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const [scheme, token] = h.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

export async function authenticate(
  req: NextApiRequest,
  res: NextApiResponse,
  opts: AuthOptions = {}
): Promise<Principal | null> {
  const token = bearer(req);
  if (token) {
    try {
      const claims = verifyToken(token);
      if (!(await accountIsActive(claims.id))) return null;
      return { kind: 'user', userId: claims.id, email: claims.email, roles: claims.roles, role: highestRole(claims.roles), via: 'jwt' };
    } catch {
      // A bad token never falls through to NextAuth. It may still be the owner on
      // loopback: the offline Mac holds a token issued by the Ubuntu server, which
      // its own local API cannot verify — loopback trust needs no token anyway.
      return localPrincipalIfTrusted(req, opts);
    }
  }

  try {
    const [{ getServerSession }, { authOptions }] = await Promise.all([
      import('next-auth/next'),
      import('@/lib/auth/options'),
    ]);
    const session = await getServerSession(req, res, authOptions);
    const u = session?.user as { id?: string; email?: string | null; role?: string } | undefined;
    if (u?.id) {
      const roles = u.role ? [u.role] : ['USER'];
      return { kind: 'user', userId: u.id, email: u.email ?? '', roles, role: highestRole(roles), via: 'nextauth' };
    }
  } catch {
    /* NextAuth not configured — ignore */
  }

  return localPrincipalIfTrusted(req, opts);
}

function localPrincipalIfTrusted(req: NextApiRequest, opts: AuthOptions): Principal | null {
  if (opts.allowLocal && loopbackTrustEnabled() && isTrustedLoopback({ remoteAddress: req.socket?.remoteAddress, headers: req.headers })) {
    return { kind: 'local' };
  }
  return null;
}

type PrincipalHandler = (req: NextApiRequest, res: NextApiResponse, principal: Principal) => unknown | Promise<unknown>;

/** Wrap a route: 401 without a principal, 403 below the required role. */
export function withPrincipal(handler: PrincipalHandler, opts: AuthOptions = {}) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const principal = await authenticate(req, res, opts);
    if (!principal) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } });
    }
    if (opts.role && principal.kind === 'user' && !hasAtLeast(principal.roles, opts.role)) {
      return res.status(403).json({ success: false, error: { message: 'Insufficient permissions', code: 'FORBIDDEN' } });
    }
    return handler(req, res, principal);
  };
}
