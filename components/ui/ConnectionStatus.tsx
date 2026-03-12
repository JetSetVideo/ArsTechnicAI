import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UserCircle2, Loader2, LogOut, Monitor, Smartphone, Tablet } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { AuthModal } from './AuthModal';
import styles from './ConnectionStatus.module.css';

interface UserMe {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  displayName: string | null;
  avatarUrl: string | null;
  totalLogins: number;
  totalMinutesOnline: number;
  _count: { projects: number; assets: number };
  devices: {
    id: string;
    name: string | null;
    browser: string | null;
    os: string | null;
    deviceType: string | null;
    city: string | null;
    country: string | null;
    countryCode: string | null;
    lastSeenAt: string;
    loginCount: number;
  }[];
}

function initials(name?: string | null) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function countryFlag(code?: string | null): string {
  if (!code || code.length !== 2) return '';
  const [a, b] = code.toUpperCase().split('');
  return (
    String.fromCodePoint(0x1f1e6 + a.charCodeAt(0) - 65) +
    String.fromCodePoint(0x1f1e6 + b.charCodeAt(0) - 65)
  );
}

function DeviceIcon({ type }: { type: string | null }) {
  if (type === 'mobile') return <Smartphone size={11} />;
  if (type === 'tablet') return <Tablet size={11} />;
  return <Monitor size={11} />;
}

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: '#f59e0b',
  ADMIN: '#6366f1',
  CREATOR: '#00d4aa',
  USER: '#64748b',
  VIEWER: '#475569',
};

export const ConnectionStatus: React.FC = () => {
  const { status } = useConnectionStatus();
  const { data: session, status: sessionStatus } = useSession();
  const [open, setOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [userMe, setUserMe] = useState<UserMe | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const isAuthenticated = sessionStatus === 'authenticated' && !!session?.user;

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Fetch extended user data when panel opens
  const fetchUserMe = useCallback(async () => {
    if (!isAuthenticated || loadingMe) return;
    setLoadingMe(true);
    try {
      const res = await fetch('/api/users/me');
      if (res.ok) {
        const { data } = await res.json();
        setUserMe(data);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingMe(false);
    }
  }, [isAuthenticated, loadingMe]);

  useEffect(() => {
    if (open && isAuthenticated && !userMe) {
      fetchUserMe();
    }
  }, [open, isAuthenticated, userMe, fetchUserMe]);

  const handleButtonClick = () => {
    if (isAuthenticated) {
      setOpen((v) => !v);
    } else {
      setShowAuthModal(true);
    }
  };

  const handleSignOut = () => {
    setOpen(false);
    signOut();
  };

  const avgMinutes =
    userMe && userMe.totalLogins > 0
      ? Math.round(userMe.totalMinutesOnline / userMe.totalLogins)
      : 0;

  return (
    <>
      <div className={`${styles.wrapper} ${styles[status]}`} ref={wrapperRef}>
        {/* Animated halo ring */}
        <span className={styles.halo} aria-hidden="true" />

        {/* Main button */}
        <button
          className={styles.button}
          onClick={handleButtonClick}
          title={isAuthenticated ? (session?.user?.name ?? 'Account') : 'Sign in'}
          aria-label={isAuthenticated ? 'Open account panel' : 'Sign in or register'}
        >
          <span className={styles.dot} />

          {sessionStatus === 'loading' ? (
            <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
          ) : isAuthenticated ? (
            <div className={styles.avatarSmall}>
              {session?.user?.image ? (
                <img src={session.user.image} alt="" />
              ) : (
                initials(session?.user?.name)
              )}
            </div>
          ) : (
            <UserCircle2 size={14} />
          )}

          <span>
            {sessionStatus === 'loading'
              ? 'Connecting…'
              : isAuthenticated
              ? (session?.user?.name?.split(' ')[0] ?? 'Account')
              : 'Sign In'}
          </span>
        </button>

        {/* Account panel (authenticated only) */}
        {open && isAuthenticated && (
          <div className={styles.panel} role="dialog" aria-label="Account panel">
            {/* Header */}
            <div className={styles.panelHeader}>
              <div className={styles.panelAvatar}>
                {session?.user?.image ? (
                  <img src={session.user.image} alt="" />
                ) : (
                  initials(session?.user?.name)
                )}
              </div>
              <div className={styles.panelUserInfo}>
                <div className={styles.panelName}>{userMe?.displayName ?? session?.user?.name ?? 'User'}</div>
                <div className={styles.panelEmail}>{session?.user?.email}</div>
                {userMe?.role && (
                  <span
                    className={styles.roleBadge}
                    style={{ color: ROLE_COLORS[userMe.role] ?? '#64748b' }}
                  >
                    {userMe.role}
                  </span>
                )}
              </div>
            </div>

            {/* Stats row */}
            {userMe && (
              <div className={styles.statsRow}>
                <span>{userMe.totalLogins} logins</span>
                <span className={styles.statDot}>·</span>
                <span>{avgMinutes} avg min</span>
                <span className={styles.statDot}>·</span>
                <span>{userMe._count.projects} projects</span>
                <span className={styles.statDot}>·</span>
                <span>{userMe.devices.length} devices</span>
              </div>
            )}

            <div className={styles.panelDivider} />

            {/* Device list */}
            {loadingMe && !userMe && (
              <div className={styles.panelLoading}>
                <Loader2 size={12} className={styles.spin} /> Loading…
              </div>
            )}

            {userMe && userMe.devices.length > 0 && (
              <div className={styles.deviceSection}>
                <div className={styles.sectionLabel}>Recent devices</div>
                {userMe.devices.slice(0, 3).map((device) => (
                  <div key={device.id} className={styles.deviceRow}>
                    <DeviceIcon type={device.deviceType} />
                    <div className={styles.deviceInfo}>
                      <span className={styles.deviceName}>
                        {device.name ?? `${device.browser} on ${device.os}`}
                      </span>
                      <span className={styles.deviceMeta}>
                        {device.city
                          ? `${countryFlag(device.countryCode)} ${device.city}`
                          : device.country ?? 'Unknown location'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.panelDivider} />

            <button className={styles.signOutBtn} onClick={handleSignOut}>
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        )}
      </div>

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          callbackUrl={typeof window !== 'undefined' ? window.location.href : '/'}
        />
      )}
    </>
  );
};
