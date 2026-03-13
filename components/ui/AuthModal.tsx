import React, { useState, useRef, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { X, Mail, Lock, User, Loader2 } from 'lucide-react';
import styles from './AuthModal.module.css';

interface AuthModalProps {
  onClose: () => void;
  callbackUrl?: string;
  defaultTab?: 'login' | 'register';
}

type Tab = 'login' | 'register';

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, callbackUrl = '/', defaultTab = 'login' }) => {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      try {
        const result = await signIn('credentials', {
          email: loginEmail,
          password: loginPassword,
          redirect: false,
          callbackUrl,
        });
        if (result?.error) {
          setError('Invalid email or password.');
        } else {
          onClose();
          window.location.reload();
        }
      } catch {
        setError('Sign-in failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [loginEmail, loginPassword, callbackUrl, onClose]
  );

  const handleRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: regName, email: regEmail, password: regPassword }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error?.message ?? 'Registration failed.');
          return;
        }
        // Sign in immediately after registration
        await signIn('credentials', {
          email: regEmail,
          password: regPassword,
          callbackUrl,
          redirect: false,
        });
        onClose();
        window.location.reload();
      } catch {
        setError('Registration failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [regName, regEmail, regPassword, callbackUrl, onClose]
  );

  const handleOAuth = (provider: 'google' | 'github') => {
    signIn(provider, { callbackUrl: window.location.href });
  };

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div className={styles.card} role="dialog" aria-modal="true" aria-label="Sign in">
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>

        <div className={styles.brand}>
          <span className={styles.brandArs}>Ars</span>
          <span className={styles.brandTechnic}>Technic</span>
          <span className={styles.brandAI}>AI</span>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'login' ? styles.activeTab : ''}`}
            onClick={() => { setTab('login'); setError(null); }}
          >
            Sign In
          </button>
          <button
            className={`${styles.tab} ${tab === 'register' ? styles.activeTab : ''}`}
            onClick={() => { setTab('register'); setError(null); }}
          >
            Register
          </button>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        {tab === 'login' ? (
          <form className={styles.form} onSubmit={handleLogin}>
            <label className={styles.field}>
              <Mail size={14} className={styles.fieldIcon} />
              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className={styles.input}
                required
                autoComplete="email"
              />
            </label>
            <label className={styles.field}>
              <Lock size={14} className={styles.fieldIcon} />
              <input
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className={styles.input}
                required
                autoComplete="current-password"
              />
            </label>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <Loader2 size={14} className={styles.spin} /> : 'Sign In'}
            </button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={handleRegister}>
            <label className={styles.field}>
              <User size={14} className={styles.fieldIcon} />
              <input
                type="text"
                placeholder="Display name"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className={styles.input}
                required
                minLength={2}
                autoComplete="name"
              />
            </label>
            <label className={styles.field}>
              <Mail size={14} className={styles.fieldIcon} />
              <input
                type="email"
                placeholder="Email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className={styles.input}
                required
                autoComplete="email"
              />
            </label>
            <label className={styles.field}>
              <Lock size={14} className={styles.fieldIcon} />
              <input
                type="password"
                placeholder="Password (min 8 chars)"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className={styles.input}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <Loader2 size={14} className={styles.spin} /> : 'Create Account'}
            </button>
          </form>
        )}

        <div className={styles.dividerRow}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>or continue with</span>
          <span className={styles.dividerLine} />
        </div>

        <div className={styles.oauthRow}>
          <button
            className={styles.oauthBtn}
            onClick={() => handleOAuth('google')}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>
          <button
            className={styles.oauthBtn}
            onClick={() => handleOAuth('github')}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            GitHub
          </button>
        </div>
      </div>
    </div>
  );
};
