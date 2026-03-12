/**
 * AuthContext
 *
 * Thin wrapper around authStore for components that prefer a React context API.
 * The source of truth is authStore (Zustand, persisted to localStorage).
 * Sessions are automatically restored when valid and cleared when expired.
 */
import React, { createContext, useContext } from 'react';
import { useAuthStore, type AuthUser } from '@/stores/authStore';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (
    firstName: string,
    lastName: string,
    email: string,
    pseudonym: string,
    password: string
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    setAuth(data.user, data.token, data.expiresIn);
  };

  const register = async (
    firstName: string,
    lastName: string,
    email: string,
    pseudonym: string,
    password: string
  ) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, pseudonym, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    setAuth(data.user, data.token, data.expiresIn);
  };

  const logout = () => clearAuth();

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
