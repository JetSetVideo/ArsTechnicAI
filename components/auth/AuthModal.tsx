import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, Mail, User, Lock, AtSign } from 'lucide-react';
import { FaGoogle } from 'react-icons/fa';
import { useAuthStore } from '@/stores/authStore';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'register';

interface FormError {
  field?: string;
  message: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem 0.75rem 0.625rem 2.5rem',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-ui)',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box' as const,
  transition: 'border-color 0.15s ease',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: '0.375rem',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

interface FieldProps {
  label: string;
  icon: React.ReactNode;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  rightElement?: React.ReactNode;
}

function Field({ label, icon, type = 'text', value, onChange, placeholder, error, autoComplete, rightElement }: FieldProps) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted)', display: 'flex', alignItems: 'center', pointerEvents: 'none',
        }}>
          {icon}
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{
            ...inputStyle,
            ...(rightElement ? { paddingRight: '2.75rem' } : {}),
            ...(error ? { borderColor: 'var(--error)' } : {}),
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = error ? 'var(--error)' : 'var(--accent-primary)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? 'var(--error)' : 'var(--border-color)';
          }}
        />
        {rightElement && (
          <span style={{
            position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center', cursor: 'pointer',
          }}>
            {rightElement}
          </span>
        )}
      </div>
      {error && (
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--error)' }}>{error}</p>
      )}
    </div>
  );
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mode, setMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPseudonym, setRegPseudonym] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  const reset = () => {
    setError(null);
    setIsLoading(false);
    setShowPassword(false);
    setShowConfirm(false);
  };

  const switchMode = (m: AuthMode) => {
    reset();
    setMode(m);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginEmail || !loginPassword) {
      setError({ message: 'Please fill in all fields' });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      setAuth(data.user, data.token, data.expiresIn);
      reset();
      onClose();
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Login failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!regFirstName.trim()) { setError({ field: 'firstName', message: 'First name is required' }); return; }
    if (!regLastName.trim()) { setError({ field: 'lastName', message: 'Last name is required' }); return; }
    if (!regEmail.trim()) { setError({ field: 'email', message: 'Email is required' }); return; }
    if (!regPseudonym.trim()) { setError({ field: 'pseudonym', message: 'Pseudonym is required' }); return; }
    if (regPassword.length < 8) { setError({ field: 'password', message: 'Password must be at least 8 characters' }); return; }
    if (regPassword !== regConfirm) { setError({ field: 'confirm', message: 'Passwords do not match' }); return; }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: regFirstName.trim(),
          lastName: regLastName.trim(),
          email: regEmail.trim(),
          pseudonym: regPseudonym.trim(),
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');
      setAuth(data.user, data.token, data.expiresIn);
      reset();
      onClose();
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Registration failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const res = await fetch('/api/auth/google', { method: 'POST' });
      const googleAuthUrl = await res.json();
      if (typeof googleAuthUrl === 'string') {
        window.location.href = googleAuthUrl;
      }
    } catch {
      setError({ message: 'Google sign-in failed. Please try again.' });
    }
  };

  if (!isOpen) return null;

  const tabBase: React.CSSProperties = {
    flex: 1,
    padding: '0.5rem',
    border: 'none',
    borderRadius: '6px',
    fontFamily: 'var(--font-ui)',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };

  const submitBtn: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    background: isLoading ? 'var(--bg-elevated)' : 'var(--accent-primary)',
    color: isLoading ? 'var(--text-muted)' : '#000',
    border: 'none',
    borderRadius: '8px',
    fontFamily: 'var(--font-ui)',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: isLoading ? 'not-allowed' : 'pointer',
    transition: 'opacity 0.15s ease',
    letterSpacing: '0.01em',
  };

  return (
    <AnimatePresence>
      <motion.div
        key="auth-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 2000,
        }}
        onClick={onClose}
      >
        <motion.div
          key="auth-modal"
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: '440px', margin: '1rem',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.75rem',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {mode === 'login' ? 'Welcome back' : 'Create an account'}
              </h2>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {mode === 'login' ? 'Sign in to continue to Ars Technic AI' : 'Join Ars Technic AI'}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', display: 'flex', padding: '4px', borderRadius: '6px',
                marginLeft: '1rem', flexShrink: 0,
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Mode tabs */}
          <div style={{
            display: 'flex', gap: '4px', marginBottom: '1.5rem',
            background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '8px',
          }}>
            <button
              style={{
                ...tabBase,
                background: mode === 'login' ? 'var(--bg-secondary)' : 'transparent',
                color: mode === 'login' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: mode === 'login' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              }}
              onClick={() => switchMode('login')}
            >
              Sign In
            </button>
            <button
              style={{
                ...tabBase,
                background: mode === 'register' ? 'var(--bg-secondary)' : 'transparent',
                color: mode === 'register' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: mode === 'register' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              }}
              onClick={() => switchMode('register')}
            >
              Create Account
            </button>
          </div>

          {/* Google */}
          <button
            onClick={handleGoogleSignIn}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.625rem', padding: '0.625rem', marginBottom: '1.25rem',
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
              borderRadius: '8px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
              fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
              transition: 'border-color 0.15s ease, background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-strong)';
              e.currentTarget.style.background = 'var(--bg-elevated)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.background = 'var(--bg-tertiary)';
            }}
          >
            <FaGoogle size={16} color="#ea4335" />
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' as const }}>or with email</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
          </div>

          {/* Global error */}
          {error && !error.field && (
            <div style={{
              padding: '0.625rem 0.75rem', marginBottom: '1rem', borderRadius: '8px',
              background: 'var(--error-bg)', border: '1px solid rgba(239,68,68,0.3)',
              color: 'var(--error)', fontSize: '0.8125rem',
            }}>
              {error.message}
            </div>
          )}

          {/* Login form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <Field
                label="Email"
                icon={<Mail size={14} />}
                type="email"
                value={loginEmail}
                onChange={setLoginEmail}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <Field
                label="Password"
                icon={<Lock size={14} />}
                type={showPassword ? 'text' : 'password'}
                value={loginPassword}
                onChange={setLoginPassword}
                placeholder="Your password"
                autoComplete="current-password"
                rightElement={
                  <span onClick={() => setShowPassword((p) => !p)}>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </span>
                }
              />
              <button type="submit" disabled={isLoading} style={submitBtn}>
                {isLoading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Register form */}
          {mode === 'register' && (
            <form onSubmit={handleRegister}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 0.75rem' }}>
                <Field
                  label="First Name"
                  icon={<User size={14} />}
                  value={regFirstName}
                  onChange={setRegFirstName}
                  placeholder="Alice"
                  autoComplete="given-name"
                  error={error?.field === 'firstName' ? error.message : undefined}
                />
                <Field
                  label="Last Name"
                  icon={<User size={14} />}
                  value={regLastName}
                  onChange={setRegLastName}
                  placeholder="Doe"
                  autoComplete="family-name"
                  error={error?.field === 'lastName' ? error.message : undefined}
                />
              </div>
              <Field
                label="Email"
                icon={<Mail size={14} />}
                type="email"
                value={regEmail}
                onChange={setRegEmail}
                placeholder="you@example.com"
                autoComplete="email"
                error={error?.field === 'email' ? error.message : undefined}
              />
              <Field
                label="Pseudonym (display name)"
                icon={<AtSign size={14} />}
                value={regPseudonym}
                onChange={setRegPseudonym}
                placeholder="CoolArtist42"
                autoComplete="username"
                error={error?.field === 'pseudonym' ? error.message : undefined}
              />
              <Field
                label="Password"
                icon={<Lock size={14} />}
                type={showPassword ? 'text' : 'password'}
                value={regPassword}
                onChange={setRegPassword}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                error={error?.field === 'password' ? error.message : undefined}
                rightElement={
                  <span onClick={() => setShowPassword((p) => !p)}>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </span>
                }
              />
              <Field
                label="Confirm Password"
                icon={<Lock size={14} />}
                type={showConfirm ? 'text' : 'password'}
                value={regConfirm}
                onChange={setRegConfirm}
                placeholder="Repeat password"
                autoComplete="new-password"
                error={error?.field === 'confirm' ? error.message : undefined}
                rightElement={
                  <span onClick={() => setShowConfirm((p) => !p)}>
                    {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                  </span>
                }
              />
              <button type="submit" disabled={isLoading} style={submitBtn}>
                {isLoading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          )}

          <p style={{
            marginTop: '1rem', textAlign: 'center' as const,
            fontSize: '0.75rem', color: 'var(--text-muted)',
          }}>
            By continuing you agree to our{' '}
            <span style={{ color: 'var(--accent-primary)', cursor: 'pointer' }}>Terms of Service</span>
            {' '}and{' '}
            <span style={{ color: 'var(--accent-primary)', cursor: 'pointer' }}>Privacy Policy</span>.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AuthModal;
