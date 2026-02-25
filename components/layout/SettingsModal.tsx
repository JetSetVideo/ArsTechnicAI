import React, { useState, useEffect } from 'react';
import { X, Key, Palette, Keyboard, Save, RotateCcw, Info, Copy, UserRound, HelpCircle, Wifi } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useSettingsStore, useLogStore, useTelemetryStore, useProjectsStore } from '@/stores';
import { RECOMMENDED_GENERATION_MODELS, getRecommendedModelFallbacks } from '@/stores/settingsStore';
import { computeClientSignature, APP_VERSION } from '@/utils/clientSignature';
import { deriveDeviceTier, deriveConnectivityTier } from '@/utils/clientSignature';
import { useUserStore } from '@/stores/userStore';
import type { HealthResponse } from '@/pages/api/health';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: SettingsTab;
}

type SettingsTab = 'account' | 'api' | 'appearance' | 'shortcuts' | 'help' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'account'
}) => {
  const { settings, updateSettings, updateAIProvider, updateAppearance, resetSettings } =
    useSettingsStore();
  const log = useLogStore((s) => s.log);
  const deviceInfo = useUserStore((s) => s.deviceInfo);
  const telemetryEnabled = useTelemetryStore((s) => s.telemetryEnabled);
  const setTelemetryEnabled = useTelemetryStore((s) => s.setTelemetryEnabled);
  const latestSnapshot = useTelemetryStore((s) => s.getLatestSnapshot());

  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);
  
  useEffect(() => {
    if (isOpen && defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  const [accountHealth, setAccountHealth] = useState<HealthResponse | null>(null);
  const [accountHealthError, setAccountHealthError] = useState<string>('');
  const session = useUserStore((s) => s.session);
  const currentProject = useUserStore((s) => s.currentProject);
  const projectCount = useProjectsStore((s) => s.projects.length);

  useEffect(() => {
    if (!isOpen || activeTab !== 'account') return;
    let mounted = true;

    const loadConnectionStatus = async () => {
      setAccountHealthError('');
      try {
        const response = await fetch('/api/health');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = (await response.json()) as HealthResponse;
        if (mounted) setAccountHealth(json);
      } catch (error) {
        if (!mounted) return;
        setAccountHealthError(error instanceof Error ? error.message : 'Cannot reach health endpoint');
      }
    };

    void loadConnectionStatus();
    return () => {
      mounted = false;
    };
  }, [isOpen, activeTab]);

  const [localApiKey, setLocalApiKey] = useState(settings.aiProvider.apiKey);
  const [localEndpoint, setLocalEndpoint] = useState(
    settings.aiProvider.endpoint || ''
  );
  const [localModel, setLocalModel] = useState(settings.aiProvider.model);

  useEffect(() => {
    setLocalApiKey(settings.aiProvider.apiKey);
    setLocalEndpoint(settings.aiProvider.endpoint || '');
    setLocalModel(settings.aiProvider.model);
  }, [settings.aiProvider]);

  if (!isOpen) return null;

  const handleSave = () => {
    updateAIProvider({
      apiKey: localApiKey,
      endpoint: localEndpoint,
      model: localModel,
    });
    log('settings_change', 'Updated settings');
    onClose();
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      resetSettings();
      log('settings_change', 'Reset settings to defaults');
    }
  };

  const deviceTier = deviceInfo
    ? deriveDeviceTier(deviceInfo.hardwareConcurrency, deviceInfo.deviceMemory)
    : 'unknown';
  const connectivityTier = deviceInfo
    ? deriveConnectivityTier(deviceInfo.connectionEffectiveType)
    : 'unknown';
  const clientSignature =
    latestSnapshot?.clientSignature ?? computeClientSignature(deviceTier, connectivityTier);

  const handleCopySignature = () => {
    navigator.clipboard?.writeText(clientSignature);
    log('settings_change', 'Copied client signature to clipboard');
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'account', label: 'Account', icon: <UserRound size={16} /> },
    { id: 'api', label: 'API Keys', icon: <Key size={16} /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
    { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={16} /> },
    { id: 'help', label: 'Help', icon: <HelpCircle size={16} /> },
    { id: 'about', label: 'About', icon: <Info size={16} /> },
  ];
  const suggestedFallbacks = getRecommendedModelFallbacks(localModel);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Settings</h2>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          <nav className={styles.tabs}>
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={`${styles.tab} ${
                  activeTab === tab.id ? styles.active : ''
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className={styles.content}>
            {activeTab === 'account' && (
              <div className={styles.section}>
                <h3>Account Details</h3>
                <div className={styles.accountRow}>
                  <span className={styles.accountLabelBold}>Session:</span>
                  <span className={styles.accountValueNormal}>{session.sessionId.slice(0, 8)}...</span>
                </div>
                {typeof window !== 'undefined' && localStorage.getItem('token') && (
                  <div className={styles.accountRow}>
                    <span className={styles.accountLabelBold}>User:</span>
                    <span className={styles.accountValueNormal}>Connected User</span>
                  </div>
                )}
                <div className={styles.accountRow}>
                  <span className={styles.accountLabelBold}>Projects:</span>
                  <span className={styles.accountValueNormal}>{projectCount}</span>
                </div>
                <div className={styles.accountRow}>
                  <span className={styles.accountLabelBold}>Account age:</span>
                  <span className={styles.accountValueNormal}>{Math.floor((Date.now() - session.startedAt) / (1000 * 60 * 60 * 24))} days</span>
                </div>
                <div className={styles.accountRow}>
                  <span className={styles.accountLabelBold}>Auth token:</span>
                  <span className={styles.accountValueNormal}>{typeof window !== 'undefined' && localStorage.getItem('token') ? 'Available' : 'Not signed in'}</span>
                </div>

                <h3>Connection</h3>
                <div className={styles.accountConnectionStatus}>
                  <Wifi size={14} />
                  {accountHealthError ? (
                    <span className={styles.accountValueNormal}>Connection check failed: {accountHealthError}</span>
                  ) : accountHealth ? (
                    <span><span className={styles.accountLabelBold}>Status:</span> <span className={styles.accountValueNormal}>{accountHealth.status}</span></span>
                  ) : (
                    <span className={styles.accountValueNormal}>Checking connection...</span>
                  )}
                </div>
                {accountHealth?.services?.map((service) => (
                  <div key={service.name} className={styles.accountRow}>
                    <span className={styles.accountLabelBold}>{service.name}:</span>
                    <span className={styles.accountValueNormal}>{service.message || service.status}</span>
                  </div>
                ))}

                <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
                  <Button 
                    variant={accountHealth?.status === 'ok' ? 'danger' : 'primary'}
                    onClick={() => {
                      if (accountHealth?.status === 'ok') {
                        console.log('Disconnecting...');
                        if (typeof window !== 'undefined') localStorage.removeItem('token');
                      } else {
                        console.log('Connecting...');
                      }
                    }}
                  >
                    {accountHealth?.status === 'ok' ? 'Disconnect' : 'Connect'}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'api' && (
              <div className={styles.section}>
                <h3>NanoBanana / Google AI API</h3>
                <p className={styles.description}>
                  Connect to Google&apos;s Imagen API for image generation. Get your
                  API key from{' '}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Google AI Studio
                  </a>
                  .
                </p>

                <div className={styles.formGroup}>
                  <Input
                    label="API Key"
                    type="password"
                    value={localApiKey}
                    onChange={(e) => setLocalApiKey(e.target.value)}
                    placeholder="Enter your API key..."
                  />
                </div>

                <div className={styles.formGroup}>
                  <Input
                    label="Endpoint (optional)"
                    value={localEndpoint}
                    onChange={(e) => setLocalEndpoint(e.target.value)}
                    placeholder="https://generativelanguage.googleapis.com/v1beta"
                  />
                </div>

                <div className={styles.formGroup}>
                  <Input
                    label="Model"
                    value={localModel}
                    onChange={(e) => setLocalModel(e.target.value)}
                    placeholder="imagen-3.0-generate-002"
                  />
                </div>

                <h3>Recommended models</h3>
                <p className={styles.description}>
                  If your current model is restricted by account tier/billing, pick one of these validated options.
                </p>
                <div className={styles.themeOptions}>
                  {RECOMMENDED_GENERATION_MODELS.map((modelName) => (
                    <button
                      key={modelName}
                      type="button"
                      className={`${styles.themeOption} ${localModel === modelName ? styles.active : ''}`}
                      onClick={() => setLocalModel(modelName)}
                    >
                      {modelName}
                    </button>
                  ))}
                </div>
                {suggestedFallbacks.length > 0 && (
                  <p className={styles.description}>
                    Suggested fallback: <strong>{suggestedFallbacks[0]}</strong>
                  </p>
                )}

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <Input
                      label="Default Width"
                      type="number"
                      value={settings.aiProvider.defaultWidth}
                      onChange={(e) =>
                        updateAIProvider({
                          defaultWidth: parseInt(e.target.value) || 1024,
                        })
                      }
                      min={256}
                      max={2048}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <Input
                      label="Default Height"
                      type="number"
                      value={settings.aiProvider.defaultHeight}
                      onChange={(e) =>
                        updateAIProvider({
                          defaultHeight: parseInt(e.target.value) || 1024,
                        })
                      }
                      min={256}
                      max={2048}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className={styles.section}>
                <h3>Theme</h3>
                <div className={styles.themeOptions}>
                  {(['dark', 'light', 'system'] as const).map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      className={`${styles.themeOption} ${
                        settings.theme === theme ? styles.active : ''
                      }`}
                      onClick={() => updateSettings({ theme })}
                    >
                      {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </button>
                  ))}
                </div>

                <h3>Font Size</h3>
                <p className={styles.description}>
                  Adjust the interface text size for better readability.
                </p>
                <div className={styles.fontSizeOptions}>
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`${styles.fontSizeOption} ${
                        settings.appearance?.fontSize === size ? styles.active : ''
                      }`}
                      onClick={() => updateAppearance({ fontSize: size })}
                    >
                      <span className={styles.fontSizeLabel}>{size.charAt(0).toUpperCase() + size.slice(1)}</span>
                      <span className={styles.fontSizePreview} style={{ fontSize: size === 'small' ? '12px' : size === 'medium' ? '14px' : '16px' }}>Aa</span>
                    </button>
                  ))}
                </div>

                <h3>Display</h3>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={settings.appearance?.compactMode || false}
                    onChange={(e) =>
                      updateAppearance({ compactMode: e.target.checked })
                    }
                  />
                  <span>Compact mode (reduced spacing)</span>
                </label>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={settings.appearance?.showFilenames ?? true}
                    onChange={(e) =>
                      updateAppearance({ showFilenames: e.target.checked })
                    }
                  />
                  <span>Show filenames on canvas items</span>
                </label>

                <h3>Canvas</h3>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={settings.showGrid}
                    onChange={(e) =>
                      updateSettings({ showGrid: e.target.checked })
                    }
                  />
                  <span>Show grid</span>
                </label>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={settings.snapToGrid}
                    onChange={(e) =>
                      updateSettings({ snapToGrid: e.target.checked })
                    }
                  />
                  <span>Snap to grid</span>
                </label>

                <h3>Prompts</h3>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={settings.autoSavePrompts}
                    onChange={(e) =>
                      updateSettings({ autoSavePrompts: e.target.checked })
                    }
                  />
                  <span>Auto-save prompts with generated images</span>
                </label>
              </div>
            )}

            {activeTab === 'about' && (
              <div className={styles.section}>
                <h3>Client Signature</h3>
                <p className={styles.description}>
                  Unique code for your current app version and environment. Use it when reporting
                  bugs so we can correlate issues with your setup.
                </p>
                <div className={styles.signatureRow}>
                  <code className={styles.signatureCode}>{clientSignature}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopySignature}
                    icon={<Copy size={14} />}
                  >
                    Copy
                  </Button>
                </div>
                <h3>Telemetry</h3>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={telemetryEnabled}
                    onChange={(e) => setTelemetryEnabled(e.target.checked)}
                  />
                  <span>Allow telemetry sync (device/usage stats to backend)</span>
                </label>
                <p className={styles.description} style={{ marginTop: 8, fontSize: '0.75rem' }}>
                  When enabled, anonymous usage and error data is sent to help improve the app. No
                  PII is collected. Data is stored locally first and synced when online.
                </p>
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <div className={styles.section}>
                <h3>Keyboard Shortcuts</h3>
                <div className={styles.shortcuts}>
                  <div className={styles.shortcut}>
                    <span>Search</span>
                    <kbd>⌘ K</kbd>
                  </div>
                  <div className={styles.shortcut}>
                    <span>Toggle Explorer</span>
                    <kbd>⌘ 1</kbd>
                  </div>
                  <div className={styles.shortcut}>
                    <span>Toggle Timeline</span>
                    <kbd>⌘ 2</kbd>
                  </div>
                  <div className={styles.shortcut}>
                    <span>Toggle Inspector</span>
                    <kbd>⌘ 3</kbd>
                  </div>
                  <div className={styles.shortcut}>
                    <span>Delete selected</span>
                    <kbd>⌫</kbd>
                  </div>
                  <div className={styles.shortcut}>
                    <span>Copy</span>
                    <kbd>⌘ C</kbd>
                  </div>
                  <div className={styles.shortcut}>
                    <span>Paste</span>
                    <kbd>⌘ V</kbd>
                  </div>
                  <div className={styles.shortcut}>
                    <span>Select all</span>
                    <kbd>⌘ A</kbd>
                  </div>
                  <div className={styles.shortcut}>
                    <span>Zoom in</span>
                    <kbd>+</kbd>
                  </div>
                  <div className={styles.shortcut}>
                    <span>Zoom out</span>
                    <kbd>-</kbd>
                  </div>
                  <div className={styles.shortcut}>
                    <span>Reset view</span>
                    <kbd>0</kbd>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'help' && (
              <div className={styles.section}>
                <h3>Creative process</h3>
                <p className={styles.description}>
                  Ars Technic AI is built around four modes that match how you work:
                </p>
                <ul className={styles.list}>
                  <li>
                    <strong>Create</strong> — Generate new images from prompts. Add assets to the canvas and iterate.
                  </li>
                  <li>
                    <strong>Rework</strong> — Edit or vary existing images. Select an asset and refine with new prompts.
                  </li>
                  <li>
                    <strong>Composite</strong> — Arrange and layer assets on the canvas. Resize, reorder, and combine.
                  </li>
                  <li>
                    <strong>Timeline</strong> — Work with sequences and motion. Plan shots and export sequences.
                  </li>
                </ul>

                <h3>Know-how</h3>
                <ul className={styles.list}>
                  <li>Use the <strong>Explorer</strong> to manage files and generated assets. Drag items onto the canvas.</li>
                  <li>Use the <strong>Inspector</strong> to edit prompts, run variations, and adjust properties of the selected asset.</li>
                  <li>Projects are saved locally. Use <strong>Save Project</strong> from the project menu to export a <code>.arstechnic</code> file.</li>
                  <li>Configure your API key in <strong>Settings</strong> (gear icon or ⌘ ,) to enable image generation.</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            <Button variant="ghost" onClick={handleReset} icon={<RotateCcw size={14} />}>
              Reset to Defaults
            </Button>
            <span className={styles.versionLabel}>
              Development version {APP_VERSION}
            </span>
          </div>
          <div className={styles.footerRight}>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} icon={<Save size={14} />}>
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
