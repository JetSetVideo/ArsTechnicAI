import React, { useState } from 'react';
import { AuthModal } from '../auth/AuthModal';
import { useAuthStore } from '@/stores/authStore';
import { UserRound } from 'lucide-react';

const AuthButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  if (isAuthenticated && user) {
    return (
      <button
        onClick={clearAuth}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: 'var(--accent-primary-alpha)', border: '1px solid var(--accent-primary)',
          borderRadius: '6px', padding: '0.375rem 0.75rem',
          color: 'var(--accent-primary)', fontFamily: 'var(--font-ui)',
          fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
        }}
        title="Click to disconnect"
      >
        <UserRound size={14} />
        {user.pseudonym || user.email}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: 'transparent', border: '1px solid var(--border-color)',
          borderRadius: '6px', padding: '0.375rem 0.75rem',
          color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)',
          fontSize: '0.8125rem', cursor: 'pointer',
          transition: 'border-color 0.15s ease, color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-strong)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-color)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
      >
        <UserRound size={14} />
        Sign In
      </button>
      <AuthModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export default AuthButton;
