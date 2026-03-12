import React from 'react';
import { useRouter } from 'next/router';
import styles from './auth.module.css';

const ERRORS: Record<string, string> = {
  Configuration: 'Server configuration error. Contact the administrator.',
  AccessDenied: 'Access denied.',
  Verification: 'Verification link expired or already used.',
  Default: 'An authentication error occurred.',
};

export default function ErrorPage() {
  const router = useRouter();
  const errorCode = router.query.error as string | undefined;
  const message = ERRORS[errorCode ?? ''] ?? ERRORS.Default;

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
        <a href="/auth/signin" className={styles.primaryBtn} style={{ marginTop: '1rem', textAlign: 'center', display: 'block' }}>
          Back to sign in
        </a>
      </div>
    </div>
  );
}
