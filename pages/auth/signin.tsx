import React, { useState } from 'react';
import { signIn, getProviders } from 'next-auth/react';
import { GetServerSideProps } from 'next';
import type { ClientSafeProvider, LiteralUnion } from 'next-auth/react';
import type { BuiltInProviderType } from 'next-auth/providers';
import styles from './auth.module.css';

interface Props {
  providers: Record<LiteralUnion<BuiltInProviderType>, ClientSafeProvider> | null;
  callbackUrl: string;
  error?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: 'Invalid email or password.',
  Default: 'Something went wrong. Please try again.',
};

export default function SignInPage({ providers, callbackUrl, error }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(
    error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default) : null
  );

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    const result = await signIn('credentials', {
      email,
      password,
      callbackUrl,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setFormError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.Default);
    } else if (result?.url) {
      window.location.href = result.url;
    }
  };

  const oauthProviders = Object.values(providers ?? {}).filter(
    (p) => p.type === 'oauth'
  );

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logo}>
          <span className={styles.logoArs}>Ars</span>
          <span className={styles.logoTechnic}>Technic</span>
          <span className={styles.logoAI}>AI</span>
        </div>
        <p className={styles.subtitle}>Sign in to continue</p>

        {formError && <div className={styles.errorBanner}>{formError}</div>}

        {/* Credentials form */}
        <form className={styles.form} onSubmit={handleCredentials}>
          <label className={styles.label}>
            Email
            <input
              className={styles.input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </label>

          <label className={styles.label}>
            Password
            <input
              className={styles.input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </label>

          <button className={styles.primaryBtn} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* OAuth providers */}
        {oauthProviders.length > 0 && (
          <>
            <div className={styles.divider}>
              <span>or continue with</span>
            </div>
            <div className={styles.oauthButtons}>
              {oauthProviders.map((provider) => (
                <button
                  key={provider.id}
                  className={styles.oauthBtn}
                  onClick={() => signIn(provider.id, { callbackUrl })}
                >
                  {provider.name}
                </button>
              ))}
            </div>
          </>
        )}

        <div className={styles.footer}>
          No account?{' '}
          <a href="/auth/register">Create one</a>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const providers = await getProviders();
  return {
    props: {
      providers: providers ?? null,
      callbackUrl: (context.query.callbackUrl as string) ?? '/',
      error: (context.query.error as string) ?? null,
    },
  };
};
