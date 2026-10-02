/**
 * Google OAuth landing page.
 *
 * pages/api/auth/google/callback.ts redirects here (`${FRONTEND_URL}/auth/callback`,
 * falling back to this host) with either `auth_token` + `auth_expires_in`, or
 * `auth_error`. The token is verified against /api/auth/me before the session
 * is stored, then removed from the URL.
 *
 * Ported from the standalone ArsTechnicAI-Server app (app/auth/callback/page.tsx).
 */
import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore, DEFAULT_EXPIRY_MS } from '@/stores/authStore';
import { authClient } from '@/lib/auth/client';
import styles from './auth.module.css';

export default function AuthCallbackPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const ran = useRef(false);

  useEffect(() => {
    if (!router.isReady || ran.current) return;
    ran.current = true;

    const fail = (code: string) => router.replace({ pathname: '/auth/error', query: { error: code } });

    const authError = router.query.auth_error;
    if (typeof authError === 'string' && authError) return void fail(authError);

    const token = router.query.auth_token;
    if (typeof token !== 'string' || !token) return void fail('missing_token');

    const expiresIn = Number(router.query.auth_expires_in);
    const expiresInMs = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : DEFAULT_EXPIRY_MS;

    authClient
      .me(token)
      .then(({ user }) => {
        setAuth(user, token, expiresInMs);
        // replace() also drops the token from the address bar and history.
        router.replace('/home');
      })
      .catch(() => fail('invalid_token'));
  }, [router, setAuth]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoArs}>Ars</span>
          <span className={styles.logoTechnic}>Technic</span>
          <span className={styles.logoAI}>AI</span>
        </div>
        <p className={styles.subtitle} role="status" aria-live="polite">
          Completing sign-in…
        </p>
      </div>
    </div>
  );
}
