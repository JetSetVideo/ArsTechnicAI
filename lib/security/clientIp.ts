/**
 * The caller's IP for rate limiting.
 *
 * Forwarding headers are only believed when the socket itself is loopback —
 * i.e. the request came through the local nginx or a local port forward. A client
 * talking to the app directly cannot pick its own bucket with X-Forwarded-For.
 *
 * Behind nginx: X-Real-IP is overwritten by nginx ($remote_addr), so it wins.
 * X-Forwarded-For is *appended to* by nginx ($proxy_add_x_forwarded_for), so its
 * first entry is whatever the client sent — only the last entry is trustworthy.
 */
import type { IncomingMessage } from 'http';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function one(v: string | string[] | undefined): string | undefined {
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

function last(v: string | string[] | undefined): string | undefined {
  const parts = (Array.isArray(v) ? v.join(',') : v)?.split(',').map((p) => p.trim()).filter(Boolean);
  return parts?.length ? parts[parts.length - 1] : undefined;
}

export function clientIp(req: Pick<IncomingMessage, 'headers' | 'socket'>): string {
  const remote = req.socket?.remoteAddress ?? 'unknown';
  if (LOOPBACK.has(remote)) {
    return one(req.headers['x-real-ip']) ?? last(req.headers['x-forwarded-for']) ?? remote;
  }
  return remote;
}
