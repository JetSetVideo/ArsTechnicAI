/**
 * AuthButton Component
 * 
 * A modern authentication button with dropdown showing:
 * - When not authenticated: "S'inscrire" and "Connexion" options
 * - When authenticated: User avatar with account menu
 * 
 * Inspired by Linear, Figma, and Notion auth patterns.
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  UserCircle2, 
  LogOut, 
  Settings, 
  ChevronDown,
  User,
  UserPlus,
  LogIn,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  Crown,
  Shield,
  Sparkles
} from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { AuthModal } from './AuthModal';
import styles from './AuthButton.module.css';

interface UserData {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  displayName: string | null;
  avatarUrl: string | null;
  totalLogins: number;
  _count?: { projects: number; assets: number };
  devices?: Array<{
    id: string;
    name: string | null;
    browser: string | null;
    os: string | null;
    deviceType: string | null;
    city: string | null;
    country: string | null;
    countryCode: string | null;
  }>;
}

const ROLE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  SUPERADMIN: { icon: <Crown size={10} />, color: '#f59e0b', label: 'Super Admin' },
  ADMIN: { icon: <Shield size={10} />, color: '#6366f1', label: 'Admin' },
  CREATOR: { icon: <Sparkles size={10} />, color: '#00d4aa', label: 'Créateur' },
  USER: { icon: <User size={10} />, color: '#64748b', label: 'Utilisateur' },
  VIEWER: { icon: <User size={10} />, color: '#475569', label: 'Visiteur' },
};

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function getCountryFlag(code?: string | null): string {
  if (!code || code.length !== 2) return '';
  const [a, b] = code.toUpperCase().split('');
  return String.fromCodePoint(0x1f1e6 + a.charCodeAt(0) - 65) + 
         String.fromCodePoint(0x1f1e6 + b.charCodeAt(0) - 65);
}

function DeviceIcon({ type }: { type: string | null }) {
  if (type === 'mobile') return <Smartphone size={12} />;
  if (type === 'tablet') return <Tablet size={12} />;
  return <Monitor size={12} />;
}

export const AuthButton: React.FC = () => {
  const { status } = useConnectionStatus();
  const { data: session, status: sessionStatus } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const isAuthenticated = sessionStatus === 'authenticated' && !!session?.user;
  const isLoading = sessionStatus === 'loading';

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  // Fetch user data when authenticated dropdown opens
  useEffect(() => {
    if (dropdownOpen && isAuthenticated && !userData && !loadingUser) {
      setLoadingUser(true);
      fetch('/api/users/me')
        .then(res => res.ok ? res.json() : null)
        .then(data => setUserData(data?.data ?? null))
        .catch(() => {})
        .finally(() => setLoadingUser(false));
    }
  }, [dropdownOpen, isAuthenticated, userData, loadingUser]);

  const handleOpenAuthModal = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
    setDropdownOpen(false);
  };

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await signOut({ redirect: false });
  };

  const roleConfig = userData?.role ? ROLE_CONFIG[userData.role] : null;

  return (
    <>
      <div className={styles.authButtonWrapper} ref={wrapperRef}>
        {/* Main Button */}
        <button
          className={`${styles.authButton} ${isAuthenticated ? styles.authenticated : ''} ${dropdownOpen ? styles.open : ''}`}
          onClick={() => setDropdownOpen(v => !v)}
          disabled={isLoading}
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
        >
          {isLoading ? (
            <>
              <Loader2 size={14} className={styles.spinner} />
              <span className={styles.buttonText}>Chargement…</span>
            </>
          ) : isAuthenticated ? (
            <>
              <div className={styles.avatarSmall}>
                {session?.user?.image ? (
                  <img src={session.user.image} alt="" />
                ) : (
                  getInitials(session?.user?.name)
                )}
              </div>
              <span className={styles.buttonText}>
                {session?.user?.name?.split(' ')[0] ?? 'Mon compte'}
              </span>
              <ChevronDown size={12} className={styles.chevron} />
            </>
          ) : (
            <>
              <UserCircle2 size={16} />
              <span className={styles.buttonText}>Compte</span>
              <ChevronDown size={12} className={styles.chevron} />
            </>
          )}
          
          {/* Status indicator dot */}
          <span className={`${styles.statusDot} ${styles[status]}`} />
        </button>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div className={styles.dropdown} role="menu">
            {isAuthenticated ? (
              <>
                {/* User Header */}
                <div className={styles.dropdownHeader}>
                  <div className={styles.avatarLarge}>
                    {session?.user?.image ? (
                      <img src={session.user.image} alt="" />
                    ) : (
                      getInitials(session?.user?.name)
                    )}
                  </div>
                  <div className={styles.userInfo}>
                    <div className={styles.userName}>
                      {userData?.displayName ?? session?.user?.name ?? 'Utilisateur'}
                    </div>
                    <div className={styles.userEmail}>{session?.user?.email}</div>
                    {roleConfig && (
                      <div className={styles.roleBadge} style={{ color: roleConfig.color }}>
                        {roleConfig.icon}
                        <span>{roleConfig.label}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats */}
                {userData && (
                  <div className={styles.statsBar}>
                    <span>{userData.totalLogins} connexions</span>
                    <span className={styles.statSep}>•</span>
                    <span>{userData._count?.projects ?? 0} projets</span>
                    <span className={styles.statSep}>•</span>
                    <span>{userData._count?.assets ?? 0} assets</span>
                  </div>
                )}

                <div className={styles.dropdownDivider} />

                {/* Devices */}
                {userData?.devices && userData.devices.length > 0 && (
                  <div className={styles.devicesSection}>
                    <div className={styles.sectionLabel}>Appareils récents</div>
                    {userData.devices.slice(0, 3).map(device => (
                      <div key={device.id} className={styles.deviceRow}>
                        <DeviceIcon type={device.deviceType} />
                        <div className={styles.deviceInfo}>
                          <span className={styles.deviceName}>
                            {device.name ?? `${device.browser} sur ${device.os}`}
                          </span>
                          {device.city && (
                            <span className={styles.deviceLocation}>
                              {getCountryFlag(device.countryCode)} {device.city}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {userData?.devices && userData.devices.length > 0 && (
                  <div className={styles.dropdownDivider} />
                )}

                {/* Menu Items */}
                <button className={styles.menuItem} onClick={() => setDropdownOpen(false)}>
                  <Settings size={14} />
                  <span>Paramètres</span>
                </button>

                <div className={styles.dropdownDivider} />

                <button className={`${styles.menuItem} ${styles.danger}`} onClick={handleSignOut}>
                  <LogOut size={14} />
                  <span>Se déconnecter</span>
                </button>
              </>
            ) : (
              <>
                {/* Unauthenticated Menu */}
                <div className={styles.dropdownHeader}>
                  <div className={styles.welcomeIcon}>
                    <UserCircle2 size={32} />
                  </div>
                  <div className={styles.welcomeText}>
                    <div className={styles.welcomeTitle}>Bienvenue</div>
                    <div className={styles.welcomeSubtitle}>
                      Connectez-vous pour accéder à toutes les fonctionnalités
                    </div>
                  </div>
                </div>

                <div className={styles.dropdownDivider} />

                <button 
                  className={`${styles.menuItem} ${styles.primary}`} 
                  onClick={() => handleOpenAuthModal('login')}
                >
                  <LogIn size={14} />
                  <span>Connexion</span>
                </button>

                <button 
                  className={`${styles.menuItem} ${styles.secondary}`} 
                  onClick={() => handleOpenAuthModal('register')}
                >
                  <UserPlus size={14} />
                  <span>S'inscrire</span>
                </button>

                <div className={styles.dropdownFooter}>
                  <span>Nouveau sur Ars TechnicAI ?</span>
                  <button 
                    className={styles.linkButton}
                    onClick={() => handleOpenAuthModal('register')}
                  >
                    Créer un compte gratuit
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Auth Modal */}
      {authModalOpen && (
        <AuthModal
          onClose={() => setAuthModalOpen(false)}
          callbackUrl={typeof window !== 'undefined' ? window.location.href : '/'}
          defaultTab={authMode}
        />
      )}
    </>
  );
};

export default AuthButton;
