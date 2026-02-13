import React, { useState, useEffect } from 'react';
import { X, Key, Palette, Keyboard, Save, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useSettingsStore, useLogStore } from '@/stores';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'api' | 'appearance' | 'shortcuts';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { settings, updateSettings, updateAIProvider, updateAppearance, resetSettings } =
    useSettingsStore();
  const log = useLogStore((s) => s.log);

  const [activeTab, setActiveTab] = useState<SettingsTab>('api');
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

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'api', label: 'API Keys', icon: <Key size={16} /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
    { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={16} /> },
  ];

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
          </div>
        </div>

        <div className={styles.footer}>
          <Button variant="ghost" onClick={handleReset} icon={<RotateCcw size={14} />}>
            Reset to Defaults
          </Button>
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
