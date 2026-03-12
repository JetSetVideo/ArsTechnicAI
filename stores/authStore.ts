import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  role: string | null;
  setAuth: (userId: string, role: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  userId: null,
  role: null,
  setAuth: (userId, role) => set({ isAuthenticated: true, userId, role }),
  clearAuth: () => set({ isAuthenticated: false, userId: null, role: null }),
}));
