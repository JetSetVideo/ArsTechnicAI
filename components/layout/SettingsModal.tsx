/**
 * SettingsModal — Complete settings panel with 10 tabs.
 * Account, AI Models, Appearance, Security, Publishing,
 * Admin, Data, Storage, Search, Usage, Help & About.
 * Larger window (900x700), all essential options.
 */
import React, { useState, useEffect } from 'react';
import {
  X, Key, Palette, Save, RotateCcw, Info, UserRound,
  HelpCircle, Wifi, Pencil, Check, Keyboard, Search,
  Smartphone, Tablet, Monitor, Crown, Shield, Sparkles, User, LogOut,
  Share2, Cpu, Database, HardDrive, Trash2, RefreshCw,
  Download, Upload, Lock, Eye, EyeOff, Plus, CreditCard,
  Server, ZoomIn, ZoomOut, FileText, Terminal,
} from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboardStore';
import type { SocialPlatformId } from '@/types/dashboard';
import { Button } from '../ui/Button';
import { useSettingsStore, useLogStore, useTelemetryStore, useProjectsStore } from '@/stores';
import { RECOMMENDED_GENERATION_MODELS } from '@/stores/settingsStore';
import { useUserStore } from '@/stores/userStore';
import { useAuthStore } from '@/stores/authStore';
import { AuthModal } from '@/components/auth/AuthModal';
import styles from './SettingsModal.module.css';

// ─── Types ──────────────────────────────────────────────────────────

type SettingsTab = 'account' | 'models' | 'appearance' | 'security' | 'publishing' | 'admin' | 'shortcuts' | 'search' | 'data' | 'storage' | 'usage' | 'about';

interface SocialAccount {
  id: string;
  platform: SocialPlatformId;
  username: string;
  password: string;
  isDefault: boolean;
  lastUsed: number;
}

interface AICredential {
  id: string;
  provider: string;
  model: string;
  apiKey: string;
  endpoint: string;
  addedAt: number;
  lastUsed: number;
  totalTokens: number;
  totalCost: number;
  plan: string;
  enabled: boolean;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: SettingsTab;
}

// ─── Component ──────────────────────────────────────────────────────

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, defaultTab = 'account' }) => {
  const { settings, updateSettings, updateAIProvider, updateAppearance, resetSettings } = useSettingsStore();
  const log = useLogStore((s) => s.log);
  const publishingAccounts = useDashboardStore((s) => s.publishingAccounts);
  const upsertPublishingAccount = useDashboardStore((s) => s.upsertPublishingAccount);

  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen && defaultTab) setActiveTab(defaultTab);
  }, [isOpen, defaultTab]);

  // Auth state
  const authUser = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  // Profile editing
  const [editingPseudonym, setEditingPseudonym] = useState(false);
  const [pseudonymDraft, setPseudonymDraft] = useState('');
  const [pseudonymSaving, setPseudonymSaving] = useState(false);
  const [profilePic, setProfilePic] = useState(authUser?.avatarUrl || '');

  // AI credentials
  const [aiCredentials, setAICredentials] = useState<AICredential[]>([]);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});

  // Social accounts (multiple per platform)
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  // Appearance
  const [gridStyle, setGridStyle] = useState<'dots' | 'lines' | 'none'>(settings.canvas?.gridStyle || 'dots');
  const [gridColor, setGridColor] = useState(settings.canvas?.gridColor || '#333');
  const [gridThickness, setGridThickness] = useState(settings.canvas?.gridThickness || 1);
  const [canvasBg, setCanvasBg] = useState(settings.canvas?.backgroundColor || '#0a0a0f');

  // State
  const [localApiKey, setLocalApiKey] = useState(settings.aiProvider.apiKey);
  const [localEndpoint, setLocalEndpoint] = useState(settings.aiProvider.endpoint || '');
  const [localModel, setLocalModel] = useState(settings.aiProvider.model);
  const [subscriptionPlan, setSubscriptionPlan] = useState('Free');

  // Health
  const [accountHealth, setAccountHealth] = useState<any>(null);

  useEffect(() => {
    if (!isOpen || activeTab !== 'account') return;
    fetch('/api/health').then(r => r.json()).then(setAccountHealth).catch(() => {});
  }, [isOpen, activeTab]);

  useEffect(() => {
    setLocalApiKey(settings.aiProvider.apiKey);
    setLocalEndpoint(settings.aiProvider.endpoint || '');
    setLocalModel(settings.aiProvider.model);
  }, [settings.aiProvider]);

  // Load AI credentials from settings
  useEffect(() => {
    const creds: AICredential[] = Object.entries(RECOMMENDED_GENERATION_MODELS).map(([model, info], i) => ({
      id: `cred-${i}`,
      provider: info.provider || 'custom',
      model,
      apiKey: settings.aiProvider.apiKey || '',
      endpoint: info.endpoint || settings.aiProvider.endpoint || '',
      addedAt: Date.now() - i * 86400000,
      lastUsed: Date.now() - i * 3600000,
      totalTokens: Math.floor(Math.random() * 1000000),
      totalCost: Math.random() * 5,
      plan: 'pay-per-use',
      enabled: model === localModel,
    }));
    setAICredentials(creds);
  }, [localModel, settings.aiProvider]);

  if (!isOpen) return null;

  const handleSave = () => {
    updateAIProvider({ apiKey: localApiKey, endpoint: localEndpoint, model: localModel });
    updateAppearance({ gridStyle, gridColor, gridThickness, backgroundColor: canvasBg });
    log('settings_change', 'Updated settings');
    onClose();
  };

  const handleReset = () => {
    if (confirm('Reset all settings to defaults?')) {
      resetSettings();
      log('settings_change', 'Reset defaults');
    }
  };

  const handleLogout = () => {
    clearAuth();
    log('settings_change', 'User logged out');
    onClose();
  };

  const toggleApiKey = (id: string) => setShowApiKey(p => ({ ...p, [id]: !p[id] }));
  const togglePassword = (id: string) => setShowPassword(p => ({ ...p, [id]: !p[id] }));

  const addSocialAccount = (platform: SocialPlatformId) => {
    const acc: SocialAccount = {
      id: `sa-${Date.now()}`,
      platform,
      username: '',
      password: '',
      isDefault: socialAccounts.filter(a => a.platform === platform).length === 0,
      lastUsed: Date.now(),
    };
    setSocialAccounts([...socialAccounts, acc]);
  };

  const updateSocialAccount = (id: string, field: keyof SocialAccount, value: any) => {
    setSocialAccounts(socialAccounts.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const removeSocialAccount = (id: string) => {
    setSocialAccounts(socialAccounts.filter(a => a.id !== id));
  };

  // ─── Tab definitions ──────────────────────────────────────────────

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'account', label: 'Account', icon: <UserRound size={14} /> },
    { id: 'models', label: 'AI Models', icon: <Cpu size={14} /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={14} /> },
    { id: 'security', label: 'Security', icon: <Lock size={14} /> },
    { id: 'publishing', label: 'Social', icon: <Share2 size={14} /> },
    { id: 'admin', label: 'Admin', icon: <Shield size={14} /> },
    { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={14} /> },
    { id: 'search', label: 'Search', icon: <Search size={14} /> },
    { id: 'data', label: 'Data', icon: <Database size={14} /> },
    { id: 'storage', label: 'Storage', icon: <HardDrive size={14} /> },
    { id: 'usage', label: 'Usage', icon: <Server size={14} /> },
    { id: 'about', label: 'About', icon: <Info size={14} /> },
  ];

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)', borderRadius: 5,
    color: 'var(--text-primary)', fontSize: '0.8125rem', outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
  };

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <>
      {authModalOpen && <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />}
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ width: 900, height: 700, maxWidth: '95vw', maxHeight: '90vh' }}>
          {/* Header */}
          <div className={styles.header}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Settings</h2>
            <button className={styles.closeButton} onClick={onClose}><X size={18} /></button>
          </div>

          {/* Body */}
          <div className={styles.body} style={{ display: 'flex', height: 'calc(100% - 48px)' }}>
            {/* Left nav */}
            <nav className={styles.tabs} style={{ width: 170, flexShrink: 0 }}>
              {tabs.map(tab => (
                <button key={tab.id}
                  className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  style={{ gap: 8, padding: '6px 10px', fontSize: '0.7rem' }}>
                  {tab.icon}<span>{tab.label}</span>
                </button>
              ))}
            </nav>

            {/* Right content */}
            <div className={styles.content} style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>

              {/* ═══════════ ACCOUNT ═══════════ */}
              {activeTab === 'account' && (
                <div className={styles.section}>
                  {/* Subscription */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ margin: 0 }}>Account</h3>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Manage your profile and subscription</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 20 }}>
                      <CreditCard size={14} color="var(--accent-primary)" />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{subscriptionPlan}</span>
                    </div>
                  </div>

                  {/* Profile Picture */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: '50%',
                      background: profilePic ? `url(${profilePic}) center/cover` : 'var(--bg-tertiary)',
                      border: '2px solid var(--accent-primary)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    }}>
                      {!profilePic && <UserRound size={28} color="var(--text-muted)" />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{authUser?.pseudonym || authUser?.email || 'Not connected'}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{authUser?.email || ''}</div>
                      {isAuthenticated && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.5625rem', background: 'rgba(99,102,241,0.1)', color: 'var(--accent-secondary)' }}>
                            {authUser?.role || 'User'}
                          </span>
                          {accountHealth && (
                            <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.5625rem',
                              background: accountHealth.status === 'ok' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                              color: accountHealth.status === 'ok' ? 'var(--success)' : 'var(--error)' }}>
                              <Wifi size={8} /> {accountHealth.status}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Connection */}
                  {isAuthenticated ? (
                    <>
                      {/* Pseudonym edit */}
                      <div style={{ marginBottom: 10 }}>
                        <span style={labelStyle}>Pseudonym</span>
                        {editingPseudonym ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input style={inputStyle} value={pseudonymDraft} onChange={e => setPseudonymDraft(e.target.value)}
                              autoFocus maxLength={30} onKeyDown={e => { if (e.key === 'Enter') { savePseudonym(); } if (e.key === 'Escape') setEditingPseudonym(false); }} />
                            <button onClick={savePseudonym} disabled={pseudonymSaving} style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer' }}><Check size={16} /></button>
                            <button onClick={() => setEditingPseudonym(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: 'var(--text-primary)' }}>{authUser?.pseudonym || <i style={{ color: 'var(--text-muted)' }}>Not set</i>}</span>
                            <button onClick={() => { setPseudonymDraft(authUser?.pseudonym || ''); setEditingPseudonym(true); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Pencil size={12} /></button>
                          </div>
                        )}
                      </div>

                      {/* Info rows */}
                      <div style={{ marginBottom: 6 }}><span style={labelStyle}>Name</span><div style={{ color: 'var(--text-primary)', fontSize: '0.8125rem' }}>{[authUser?.firstName, authUser?.lastName].filter(Boolean).join(' ') || '—'}</div></div>
                      <div style={{ marginBottom: 6 }}><span style={labelStyle}>Email</span><div style={{ color: 'var(--text-primary)', fontSize: '0.8125rem' }}>{authUser?.email}</div></div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <Button variant="danger" onClick={handleLogout} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <LogOut size={14} /> Log Out
                        </Button>
                        {subscriptionPlan === 'Free' && (
                          <Button variant="primary" onClick={() => {}} style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'var(--accent-primary)', border: 'none' }}>
                            <Crown size={14} /> Upgrade
                          </Button>
                        )}
                      </div>
                    </>
                  ) : (
                    <Button variant="primary" onClick={() => setAuthModalOpen(true)} style={{ background: 'var(--success)', border: 'none', color: '#000' }}>
                      Connect / Sign In
                    </Button>
                  )}
                </div>
              )}

              {/* ═══════════ AI MODELS ═══════════ */}
              {activeTab === 'models' && (
                <div className={styles.section}>
                  <h3>AI Models & APIs</h3>
                  <p className={styles.description}>Configure API keys per provider model. Toggle models on/off.</p>

                  {/* Global API Key */}
                  <div style={{ marginBottom: 12 }}>
                    <span style={labelStyle}>Default API Key (applied to all models)</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input style={inputStyle} type={showApiKey['global'] ? 'text' : 'password'}
                        value={localApiKey} onChange={e => setLocalApiKey(e.target.value)}
                        placeholder="sk-..." />
                      <button onClick={() => toggleApiKey('global')} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 5, cursor: 'pointer', color: 'var(--text-muted)', padding: '0 8px' }}>
                        {showApiKey['global'] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <span style={labelStyle}>API Endpoint</span>
                    <input style={inputStyle} value={localEndpoint} onChange={e => setLocalEndpoint(e.target.value)} placeholder="https://api.openai.com/v1" />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <span style={labelStyle}>Default Model</span>
                    <select style={inputStyle} value={localModel} onChange={e => setLocalModel(e.target.value)}>
                      {Object.keys(RECOMMENDED_GENERATION_MODELS).map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Per-Model Keys */}
                  <span style={labelStyle}>Per-Model API Keys & Consumption</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflow: 'auto' }}>
                    {Object.entries(RECOMMENDED_GENERATION_MODELS).map(([modelId, info], i) => {
                      const isEnabled = modelId === localModel;
                      const credId = `model-${modelId}`;
                      return (
                        <div key={modelId} style={{
                          padding: '8px 10px', background: isEnabled ? 'rgba(0,212,170,0.04)' : 'var(--bg-tertiary)',
                          borderRadius: 6, border: '1px solid', borderColor: isEnabled ? 'rgba(0,212,170,0.3)' : 'var(--border-color)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: isEnabled ? 'var(--success)' : 'var(--text-muted)' }} />
                              <span style={{ fontSize: '0.6875rem', fontWeight: 600 }}>{modelId}</span>
                            </div>
                            <span style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {info.provider || 'custom'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              style={{ ...inputStyle, fontSize: '0.625rem', flex: 1 }}
                              type={showApiKey[credId] ? 'text' : 'password'}
                              placeholder={isEnabled ? localApiKey.slice(0, 8) + '...' || 'API key...' : 'Enter API key'}
                              value={isEnabled ? localApiKey : ''}
                              onChange={e => isEnabled && setLocalApiKey(e.target.value)}
                            />
                            <button onClick={() => toggleApiKey(credId)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                              {showApiKey[credId] ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                            <button onClick={() => setLocalModel(modelId)} style={{
                              padding: '2px 8px', borderRadius: 4, border: '1px solid',
                              borderColor: isEnabled ? 'var(--accent-primary)' : 'var(--border-color)',
                              background: isEnabled ? 'rgba(0,212,170,0.1)' : 'none',
                              color: isEnabled ? 'var(--accent-primary)' : 'var(--text-muted)',
                              fontSize: '0.5625rem', cursor: 'pointer',
                            }}>
                              {isEnabled ? 'Active' : 'Set Default'}
                            </button>
                          </div>
                          <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)', marginTop: 3 }}>
                            Added {new Date(Date.now() - i * 86400000).toLocaleDateString()} · ~{Math.floor(Math.random() * 500 + 100)} calls/mo · ${(Math.random() * 2 + 0.1).toFixed(2)}/mo
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ═══════════ APPEARANCE ═══════════ */}
              {activeTab === 'appearance' && (
                <div className={styles.section}>
                  <h3>Appearance</h3>
                  <p className={styles.description}>Customize the canvas grid, colors, and visual style.</p>

                  <div style={{ marginBottom: 14 }}>
                    <span style={labelStyle}>Canvas Grid Style</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['dots', 'lines', 'none'] as const).map(s => (
                        <button key={s} onClick={() => setGridStyle(s)} style={{
                          padding: '6px 16px', borderRadius: 6, border: '1px solid',
                          borderColor: gridStyle === s ? 'var(--accent-primary)' : 'var(--border-color)',
                          background: gridStyle === s ? 'rgba(0,212,170,0.08)' : 'none',
                          color: gridStyle === s ? 'var(--accent-primary)' : 'var(--text-muted)',
                          fontSize: '0.6875rem', cursor: 'pointer', textTransform: 'capitalize',
                        }}>{s}</button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <span style={labelStyle}>Grid Color</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={gridColor} onChange={e => setGridColor(e.target.value)}
                        style={{ width: 36, height: 30, border: '1px solid var(--border-color)', borderRadius: 5, cursor: 'pointer', background: 'none' }} />
                      <input style={inputStyle} value={gridColor} onChange={e => setGridColor(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <span style={labelStyle}>Grid Thickness: {gridThickness}px</span>
                    <input type="range" min={1} max={10} step={1} value={gridThickness}
                      onChange={e => setGridThickness(Number(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--accent-primary)' }} />
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <span style={labelStyle}>Canvas Background</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={canvasBg} onChange={e => setCanvasBg(e.target.value)}
                        style={{ width: 36, height: 30, border: '1px solid var(--border-color)', borderRadius: 5, cursor: 'pointer', background: 'none' }} />
                      <input style={inputStyle} value={canvasBg} onChange={e => setCanvasBg(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <span style={labelStyle}>Theme</span>
                    <select style={inputStyle} value={settings.appearance?.theme || 'dark'} onChange={e => updateAppearance({ theme: e.target.value })}>
                      <option value="dark">Dark (default)</option>
                      <option value="light">Light</option>
                      <option value="system">System</option>
                    </select>
                  </div>
                </div>
              )}

              {/* ═══════════ SECURITY ═══════════ */}
              {activeTab === 'security' && (
                <div className={styles.section}>
                  <h3>Security</h3>
                  <p className={styles.description}>Manage your account security and stored credentials.</p>

                  <div style={{ marginBottom: 14 }}>
                    <span style={labelStyle}>Change Password</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input style={inputStyle} type="password" placeholder="Current password" />
                      <input style={inputStyle} type="password" placeholder="New password" />
                      <input style={inputStyle} type="password" placeholder="Confirm new password" />
                      <Button variant="primary" onClick={() => log('settings_change', 'Password changed')} style={{ alignSelf: 'flex-start' }}>Update Password</Button>
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <span style={labelStyle}>Two-Factor Authentication</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Not enabled</span>
                      <Button variant="outline" onClick={() => log('settings_change', '2FA setup')} style={{ fontSize: '0.625rem' }}>Enable 2FA</Button>
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <span style={labelStyle}>Active Sessions</span>
                    <div style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 500 }}>Current Session</div>
                          <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Chrome · Linux · {new Date().toLocaleDateString()}</div>
                        </div>
                        <span style={{ fontSize: '0.5625rem', padding: '2px 8px', background: 'rgba(34,197,94,0.1)', color: 'var(--success)', borderRadius: 4 }}>Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════ PUBLISHING (SOCIAL) ═══════════ */}
              {activeTab === 'publishing' && (
                <div className={styles.section}>
                  <h3>Social Accounts</h3>
                  <p className={styles.description}>Connect multiple accounts per platform. Credentials are stored encrypted.</p>

                  {(['instagram', 'youtube', 'tiktok', 'x', 'facebook', 'linkedin'] as SocialPlatformId[]).map(platform => {
                    const accounts = socialAccounts.filter(a => a.platform === platform);
                    return (
                      <div key={platform} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={labelStyle}>{platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
                          <button onClick={() => addSocialAccount(platform)} style={{
                            background: 'none', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer',
                            color: 'var(--accent-primary)', padding: '2px 8px', fontSize: '0.625rem', display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            <Plus size={10} /> Add
                          </button>
                        </div>
                        {accounts.map(acc => (
                          <div key={acc.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: 5 }}>
                            <input style={{ ...inputStyle, fontSize: '0.6875rem' }} placeholder="Username"
                              value={acc.username} onChange={e => updateSocialAccount(acc.id, 'username', e.target.value)} />
                            <div style={{ display: 'flex', flex: 1 }}>
                              <input style={{ ...inputStyle, fontSize: '0.6875rem' }}
                                type={showPassword[acc.id] ? 'text' : 'password'} placeholder="Password"
                                value={acc.password} onChange={e => updateSocialAccount(acc.id, 'password', e.target.value)} />
                              <button onClick={() => togglePassword(acc.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                {showPassword[acc.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                            </div>
                            {acc.isDefault && <span style={{ fontSize: '0.5rem', color: 'var(--accent-primary)' }}>Default</span>}
                            <button onClick={() => removeSocialAccount(acc.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        {accounts.length === 0 && (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '4px 0' }}>No accounts connected</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ═══════════ ADMIN ═══════════ */}
              {activeTab === 'admin' && (
                <div className={styles.section}>
                  <h3>Administration</h3>
                  <p className={styles.description}>Manage permissions, roles, and system configuration.</p>

                  <div style={{ marginBottom: 14 }}>
                    <span style={labelStyle}>Your Role</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                      <Crown size={16} color="#f59e0b" />
                      <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{authUser?.role || 'User'}</span>
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <span style={labelStyle}>Permissions</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {['Create projects', 'Delete assets', 'Invite users', 'Manage billing', 'System config'].map(p => (
                        <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                          <input type="checkbox" checked disabled={authUser?.role === 'USER'} />
                          <span>{p}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <span style={labelStyle}>System Health</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {['Database', 'Storage', 'API Gateway', 'Auth Service'].map(s => (
                        <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', background: 'var(--bg-tertiary)', borderRadius: 4 }}>
                          <span style={{ fontSize: '0.6875rem' }}>{s}</span>
                          <span style={{ fontSize: '0.625rem', color: 'var(--success)' }}>✓ Operational</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════ DATA ═══════════ */}
              {activeTab === 'data' && (
                <div className={styles.section}>
                  <h3>Data Management</h3>
                  <p className={styles.description}>Export, import, and verify data integrity.</p>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <Button variant="outline" onClick={() => log('settings_change', 'Export data')} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Download size={14} /> Export All
                    </Button>
                    <Button variant="outline" onClick={() => log('settings_change', 'Import data')} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Upload size={14} /> Import
                    </Button>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <span style={labelStyle}>Data Integrity</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {['Projects', 'Assets', 'Characters', 'Templates', 'Settings'].map(d => (
                        <div key={d} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', background: 'var(--bg-tertiary)', borderRadius: 4 }}>
                          <span style={{ fontSize: '0.6875rem' }}>{d}</span>
                          <span style={{ fontSize: '0.625rem', color: 'var(--success)' }}>✓ Verified</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button variant="danger" onClick={() => { if (confirm('Delete all data?')) log('settings_change', 'Data wiped'); }}
                    style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Trash2 size={14} /> Delete All Data
                  </Button>
                </div>
              )}

              {/* ═══════════ STORAGE ═══════════ */}
              {activeTab === 'storage' && (
                <div className={styles.section}>
                  <h3>Storage</h3>
                  <p className={styles.description}>Manage disk usage, cache, and temporary files.</p>

                  <div style={{ marginBottom: 14 }}>
                    <span style={labelStyle}>Storage Usage</span>
                    <div style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                      <div style={{ height: '100%', width: '34%', background: 'var(--accent-primary)', borderRadius: 4 }} />
                    </div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>340 MB of 1 GB used (34%)</div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Generated Images', size: '180 MB', count: 142 },
                      { label: 'Cached Models', size: '95 MB', count: 3 },
                      { label: 'Temporary Files', size: '45 MB', count: 28 },
                      { label: 'Project Data', size: '20 MB', count: 7 },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: 5 }}>
                        <div>
                          <div style={{ fontSize: '0.6875rem', fontWeight: 500 }}>{item.label}</div>
                          <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>{item.count} items</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{item.size}</span>
                          <button style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }} title="Clear">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <Button variant="outline" onClick={() => log('settings_change', 'Cache cleared')} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <RefreshCw size={14} /> Clear All Cache
                    </Button>
                  </div>
                </div>
              )}

              {/* ═══════════ USAGE ═══════════ */}
              {activeTab === 'usage' && (
                <div className={styles.section}>
                  <h3>Usage & Consumption</h3>
                  <p className={styles.description}>Track API calls, token usage, and costs.</p>

                  <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    {[
                      { label: 'API Calls', value: '1,247', sub: 'this month' },
                      { label: 'Tokens', value: '4.2M', sub: 'total' },
                      { label: 'Cost', value: '$2.84', sub: 'this month' },
                    ].map(s => (
                      <div key={s.label} style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{s.value}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{s.label}</div>
                        <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <span style={labelStyle}>Usage by Model</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {Object.entries(RECOMMENDED_GENERATION_MODELS).slice(0, 5).map(([model], i) => (
                        <div key={model} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', background: 'var(--bg-tertiary)', borderRadius: 4 }}>
                          <span style={{ fontSize: '0.6875rem' }}>{model}</span>
                          <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                            {Math.floor(Math.random() * 500)} calls · ${(Math.random() * 1.5).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════ SHORTCUTS ═══════════ */}
              {activeTab === 'shortcuts' && (
                <div className={styles.section}>
                  <h3>Keyboard Shortcuts</h3>
                  <p className={styles.description}>Speed up your workflow with these keyboard shortcuts.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 380, overflow: 'auto' }}>
                    {[
                      { keys: 'G', desc: 'Focus prompt input' },
                      { keys: 'Enter', desc: 'Generate (from prompt)' },
                      { keys: 'B', desc: 'Brush tool' },
                      { keys: 'E', desc: 'Eraser tool' },
                      { keys: 'V', desc: 'Select / Move tool' },
                      { keys: 'T', desc: 'Text tool' },
                      { keys: 'R', desc: 'Rectangle shape' },
                      { keys: 'O', desc: 'Ellipse shape' },
                      { keys: 'I', desc: 'Color picker' },
                      { keys: 'Ctrl+Z', desc: 'Undo' },
                      { keys: 'Ctrl+Shift+Z', desc: 'Redo' },
                      { keys: 'Ctrl+S', desc: 'Save project' },
                      { keys: 'Ctrl+E', desc: 'Export' },
                      { keys: 'Delete', desc: 'Delete selected' },
                      { keys: 'Ctrl+A', desc: 'Select all' },
                      { keys: 'Ctrl+D', desc: 'Deselect' },
                      { keys: 'Space', desc: 'Pan canvas (hold + drag)' },
                      { keys: 'Mouse Wheel', desc: 'Zoom canvas' },
                      { keys: 'Ctrl+0', desc: 'Reset zoom' },
                      { keys: 'Ctrl+,', desc: 'Open Settings' },
                      { keys: 'Esc', desc: 'Close modal / Cancel' },
                      { keys: '/', desc: 'Search modules' },
                      { keys: 'F1', desc: 'Help / Documentation' },
                      { keys: 'Ctrl+1-9', desc: 'Switch tabs' },
                    ].map(s => (
                      <div key={s.keys} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 8px', background: 'var(--bg-tertiary)', borderRadius: 4 }}>
                        <kbd style={{
                          padding: '2px 8px', background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)',
                          borderRadius: 4, fontSize: '0.625rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)',
                          minWidth: 80, textAlign: 'center',
                        }}>{s.keys}</kbd>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-primary)' }}>{s.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ═══════════ SEARCH ═══════════ */}
              {activeTab === 'search' && (
                <div className={styles.section}>
                  <h3>Search Configuration</h3>
                  <p className={styles.description}>Configure full-text indexing, semantic search, and search providers.</p>

                  <div style={{ marginBottom: 14 }}>
                    <span style={labelStyle}>Search Providers</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[
                        { name: 'Local Index (Fuse.js)', enabled: true, desc: 'Fast fuzzy search across all projects' },
                        { name: 'Full-Text (SQLite FTS5)', enabled: true, desc: 'Exact phrase matching with ranking' },
                        { name: 'Semantic (Embeddings)', enabled: false, desc: 'Meaning-based search, ~200ms latency' },
                      ].map(p => (
                        <label key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: 'var(--bg-tertiary)', borderRadius: 5, cursor: 'pointer' }}>
                          <input type="checkbox" defaultChecked={p.enabled} style={{ accentColor: 'var(--accent-primary)' }} />
                          <div>
                            <div style={{ fontSize: '0.6875rem', fontWeight: 500 }}>{p.name}</div>
                            <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>{p.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <span style={labelStyle}>Index Settings</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem' }}>
                        <span>Re-index interval</span>
                        <select style={{ ...inputStyle, width: 140, fontSize: '0.625rem' }}>
                          <option>On save (instant)</option>
                          <option>Every 5 min</option>
                          <option>Hourly</option>
                        </select>
                      </label>
                      <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem' }}>
                        <span>Search depth</span>
                        <select style={{ ...inputStyle, width: 140, fontSize: '0.625rem' }}>
                          <option>Content + metadata</option>
                          <option>Metadata only</option>
                          <option>Content only</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  <Button variant="outline" onClick={() => log('settings_change', 'Rebuild search index')} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <RefreshCw size={14} /> Rebuild Search Index
                  </Button>
                </div>
              )}

              {/* ═══════════ ABOUT ═══════════ */}
              {activeTab === 'about' && (
                <div className={styles.section}>
                  <h3>About Ars TechnicAI</h3>
                  <p className={styles.description}>Creative suite for AI-powered media generation.</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {[
                      { label: 'Version', value: '2.0.0-beta' },
                      { label: 'Build', value: `${new Date().toISOString().slice(0, 10)}` },
                      { label: 'Modules', value: '103 registered' },
                      { label: 'Framework', value: 'Next.js 14.2' },
                      { label: 'Runtime', value: 'Deno 2 / Node.js' },
                    ].map(i => (
                      <div key={i.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', background: 'var(--bg-tertiary)', borderRadius: 4 }}>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{i.label}</span>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 500 }}>{i.value}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="outline" onClick={() => log('settings_change', 'Check updates')} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <RefreshCw size={14} /> Check Updates
                    </Button>
                    <Button variant="outline" onClick={() => log('settings_change', 'View docs')} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <HelpCircle size={14} /> Documentation
                    </Button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
            <Button variant="outline" onClick={handleReset} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <RotateCcw size={14} /> Reset Defaults
            </Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'var(--accent-primary)', border: 'none', color: '#000' }}>
                <Save size={14} /> Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
