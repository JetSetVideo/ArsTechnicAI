/**
 * Browser-side client for the custom JWT auth API (pages/api/auth/*).
 * Ported from the standalone ArsTechnicAI-Server app (lib/api.ts).
 *
 * Same-origin by default. Set NEXT_PUBLIC_API_URL to talk to an API on another
 * host (e.g. the Mac frontend → Ubuntu server over Tailscale); that host must
 * list this origin in CORS_ALLOWED_ORIGINS (middleware.ts).
 */
import type { AuthResponse, AuthUser } from '@/stores/authStore';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  pseudonym: string;
  password: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  // Error bodies are not always JSON (proxy 502 pages, Next error HTML).
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const authClient = {
  login(payload: LoginPayload): Promise<AuthResponse> {
    return request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
  },

  register(payload: RegisterPayload): Promise<AuthResponse> {
    return request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
  },

  me(token: string): Promise<{ user: AuthUser }> {
    return request('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  },

  /** Returns the Google consent URL; the API answers `{ url }` (503 when not configured). */
  async googleAuthUrl(): Promise<string> {
    const { url } = await request<{ url: string }>('/api/auth/google', { method: 'POST' });
    if (!url) throw new Error('Google sign-in is not available');
    return url;
  },
};
