import { useSession, signIn, signOut } from 'next-auth/react';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  const { data: session, status } = useSession();
  const { setAuth, clearAuth } = useAuthStore();

  useEffect(() => {
    if (session?.user?.id) {
      setAuth(session.user.id, session.user.role);
    } else {
      clearAuth();
    }
  }, [session, setAuth, clearAuth]);

  return {
    session,
    user: session?.user,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    signIn,
    signOut,
  };
}
