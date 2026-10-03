/**
 * Server-side view of the home server for server-to-server transfers
 * (/api/sync/transfer/*). Never taken from the request: only the configured
 * NEXT_PUBLIC_API_URL, or this very server — so these routes cannot be used to
 * make this machine send files (or a token) anywhere else.
 */
import type { IncomingMessage } from 'http';

export function homeServerUrl(req: Pick<IncomingMessage, 'socket'>): string {
  const configured = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  if (configured) return configured;
  return `http://127.0.0.1:${req.socket.localPort}`;
}
