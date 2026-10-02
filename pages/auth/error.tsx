import React from 'react';
import { useRouter } from 'next/router';
import styles from './auth.module.css';

const ERRORS: Record<string, string> = {
  Configuration: 'Server configuration error. Contact the administrator.',
  AccessDenied: 'Access denied.',
  Verification: 'Verification link expired or already used.',
  // Custom JWT / Google OAuth flow (pages/api/auth/google/callback.ts → pages/auth/callback.tsx)
  access_denied: 'Google sign-in was cancelled.',
  missing_code: 'Google did not return an authorization code. Please try again.',
  missing_token: 'Sign-in did not return a session. Please try again.',
  invalid_token: 'Your session could not be verified. Please sign in again.',
  incomplete_profile: 'Your Google account did not share an email address.',
  Default: 'An authentication error occurred.',
};

export default function ErrorPage() {
  const router = useRouter();
  const errorCode = typeof router.query.error === 'string' ? router.query.error : undefined;
  // The OAuth callback forwards server messages verbatim; show them rather than a generic line.
  const message = ERRORS[errorCode ?? ''] ?? (errorCode && errorCode.length <= 200 ? errorCode : ERRORS.Default);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoArs}>Ars</span>
          <span className={styles.logoTechnic}>Technic</span>
          <span className={styles.logoAI}>AI</span>
        </div>
        <div className={styles.errorBanner} style={{ marginTop: '1rem' }}>
          {message}
        </div>
        <a href="/home" className={styles.primaryBtn} style={{ marginTop: '1rem', textAlign: 'center', display: 'block' }}>
          Back to Ars Technic AI
        </a>
      </div>
    </div>
  );
}
