import { useAuthStore } from '@/stores/authStore';

/**
 * Session hook backed by the custom JWT store (stores/authStore).
 *
 * Previously mirrored NextAuth's useSession() into the store through a
 * setAuth(userId, role) signature that no other consumer used; the app's
 * sign-in paths (AuthModal, AuthContext, /auth/callback) all write the JWT
 * session directly, so this reads from the same place.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return {
    user,
    isLoading: false,
    isAuthenticated,
    signOut: clearAuth,
  };
}
