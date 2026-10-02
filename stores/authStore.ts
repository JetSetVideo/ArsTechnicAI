import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ════════════════════════════════════════════════════════════════════════════
// AUTH STORE
// Single source of truth for the custom JWT session (services/auth/authService).
// Persisted to localStorage as `ars-auth`; restored on load while the token is
// still valid and cleared once it is within 5 minutes of expiry.
//
// Restores the persisted store from ae6a444 (replaced in dda6eb0 by a NextAuth
// stub whose setAuth(userId, role) no consumer used), merged with the
// ArsTechnicAI-Server client store (roles).
// ════════════════════════════════════════════════════════════════════════════

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  pseudonym: string | null;
  profileImage: string | null;
  roles?: string[];
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
  /** Milliseconds until the token expires (matches JWT_EXPIRATION). */
  expiresIn: number;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  tokenExpiresAt: number | null; // Unix timestamp (ms)
  isAuthenticated: boolean;

  setAuth: (user: AuthUser, token: string, expiresInMs?: number) => void;
  clearAuth: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;

  isSessionValid: () => boolean;
  getAuthHeader: () => Record<string, string>;
}

// JWT default expiry is 7 days (matches JWT_EXPIRATION in .env)
export const DEFAULT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

const isLive = (token: string | null, expiresAt: number | null) =>
  !!token && !!expiresAt && Date.now() < expiresAt - EXPIRY_MARGIN_MS;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      tokenExpiresAt: null,
      isAuthenticated: false,

      setAuth: (user, token, expiresInMs = DEFAULT_EXPIRY_MS) => {
        const ttl = Number.isFinite(expiresInMs) && expiresInMs > 0 ? expiresInMs : DEFAULT_EXPIRY_MS;
        set({ user, token, tokenExpiresAt: Date.now() + ttl, isAuthenticated: true });
      },

      clearAuth: () => {
        set({ user: null, token: null, tokenExpiresAt: null, isAuthenticated: false });
      },

      updateUser: (updates) => {
        const { user } = get();
        if (!user) return;
        set({ user: { ...user, ...updates } });
      },

      isSessionValid: () => {
        const { token, tokenExpiresAt } = get();
        return isLive(token, tokenExpiresAt);
      },

      getAuthHeader: (): Record<string, string> => {
        const { token, tokenExpiresAt } = get();
        return isLive(token, tokenExpiresAt) ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
    {
      name: 'ars-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        tokenExpiresAt: state.tokenExpiresAt,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && !isLive(state.token, state.tokenExpiresAt)) state.clearAuth();
      },
    }
  )
);
