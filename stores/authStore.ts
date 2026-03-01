import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ════════════════════════════════════════════════════════════════════════════
// AUTH STORE
// Manages authentication state with JWT session persistence.
// Sessions are automatically restored if the token hasn't expired.
// ════════════════════════════════════════════════════════════════════════════

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  pseudonym: string | null;
  profileImage: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  tokenExpiresAt: number | null; // Unix timestamp (ms)
  isAuthenticated: boolean;

  // Actions
  setAuth: (user: AuthUser, token: string, expiresInMs: number) => void;
  clearAuth: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;

  // Session helpers
  isSessionValid: () => boolean;
  getAuthHeader: () => Record<string, string>;
}

// JWT default expiry is 7 days (matches JWT_EXPIRATION in .env)
const DEFAULT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      tokenExpiresAt: null,
      isAuthenticated: false,

      setAuth: (user, token, expiresInMs = DEFAULT_EXPIRY_MS) => {
        set({
          user,
          token,
          tokenExpiresAt: Date.now() + expiresInMs,
          isAuthenticated: true,
        });
      },

      clearAuth: () => {
        set({
          user: null,
          token: null,
          tokenExpiresAt: null,
          isAuthenticated: false,
        });
      },

      updateUser: (updates) => {
        const { user } = get();
        if (!user) return;
        set({ user: { ...user, ...updates } });
      },

      isSessionValid: () => {
        const { token, tokenExpiresAt } = get();
        if (!token || !tokenExpiresAt) return false;
        // Consider the session valid if it expires more than 5 minutes from now
        return Date.now() < tokenExpiresAt - 5 * 60 * 1000;
      },

      getAuthHeader: (): Record<string, string> => {
        const { token } = get();
        if (!token) return {};
        return { Authorization: `Bearer ${token}` };
      },
    }),
    {
      name: 'ars-auth',
      // Only persist the auth-related fields
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        tokenExpiresAt: state.tokenExpiresAt,
        isAuthenticated: state.isAuthenticated,
      }),
      // On rehydration, validate that the stored session is still valid
      onRehydrateStorage: () => (state) => {
        if (state && state.token && state.tokenExpiresAt) {
          const isValid = Date.now() < state.tokenExpiresAt - 5 * 60 * 1000;
          if (!isValid) {
            // Session expired — clear it
            state.clearAuth();
          }
        }
      },
    }
  )
);
