/**
 * Attach the session's Bearer token to this app's own API calls.
 *
 * The UI has ~100 `fetch('/api/…')` call sites written before the API required
 * authentication. Rather than threading a header through each one, this wraps
 * window.fetch once (pages/_app.tsx) and adds `Authorization` only when:
 *   - the URL's path starts with /api/, and
 *   - it targets this origin or the configured home server (NEXT_PUBLIC_API_URL), and
 *   - the caller did not set Authorization itself, and
 *   - there is a live session.
 * Third-party URLs (AI providers, Google) are never touched.
 */
import { useAuthStore } from '@/stores/authStore';

const MARK = Symbol.for('ars.fetchAuth.installed');

export function apiOrigins(): string[] {
  const origins = [window.location.origin];
  const remote = process.env.NEXT_PUBLIC_API_URL;
  if (remote) {
    try {
      origins.push(new URL(remote).origin);
    } catch {
      /* ignore a malformed value */
    }
  }
  return origins;
}

/** Pure decision, unit-tested. */
export function shouldAttach(url: string, base: string, allowedOrigins: string[]): boolean {
  let u: URL;
  try {
    u = new URL(url, base);
  } catch {
    return false;
  }
  return allowedOrigins.includes(u.origin) && u.pathname.startsWith('/api/');
}

export function installAuthFetch(): void {
  if (typeof window === 'undefined') return;
  const w = window as typeof window & { [MARK]?: boolean };
  if (w[MARK]) return;
  w[MARK] = true;

  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!shouldAttach(url, window.location.href, apiOrigins())) return original(input, init);

    const auth = useAuthStore.getState().getAuthHeader();
    if (!auth.Authorization) return original(input, init);

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (headers.has('Authorization')) return original(input, init);
    headers.set('Authorization', auth.Authorization);
    return original(input, { ...init, headers });
  };
}
