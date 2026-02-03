import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, AIProviderSettings, AppearanceSettings } from '@/types';

interface SettingsState {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  updateAIProvider: (partial: Partial<AIProviderSettings>) => void;
  updateAppearance: (partial: Partial<AppearanceSettings>) => void;
  applyFontScale: () => void;
  resetSettings: () => void;
}

// Default appearance settings - extracted for reuse in migration
const defaultAppearance: AppearanceSettings = {
  fontSize: 'medium',
  fontScale: 1,
  compactMode: false,
  showFilenames: true,
};

// Default AI provider settings - extracted for reuse in migration
const defaultAIProvider: AIProviderSettings = {
  provider: 'nanobanana',
  apiKey: '',
  endpoint: 'https://generativelanguage.googleapis.com/v1beta',
  model: 'imagen-3.0-generate-001',
  defaultWidth: 1024,
  defaultHeight: 1024,
  defaultSteps: 50,
  defaultGuidanceScale: 7.5,
};

const defaultSettings: AppSettings = {
  theme: 'dark',
  appearance: defaultAppearance,
  aiProvider: defaultAIProvider,
  outputDirectory: './generated',
  autoSavePrompts: true,
  showGrid: true,
  snapToGrid: false,
  gridSize: 20,
  recentPaths: [],
};

// Font scale values for each size option
const FONT_SCALES = {
  small: 0.875,
  medium: 1,
  large: 1.125,
} as const;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,

      updateSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),

      updateAIProvider: (partial) =>
        set((state) => ({
          settings: {
            ...state.settings,
            // Defensive: ensure aiProvider exists with defaults
            aiProvider: { ...(state.settings?.aiProvider ?? defaultAIProvider), ...partial },
          },
        })),

      updateAppearance: (partial) => {
        // If fontSize is being changed, update fontScale accordingly
        // Defensive: ensure appearance exists with defaults
        const currentAppearance = get().settings?.appearance ?? defaultAppearance;
        const newAppearance = { ...currentAppearance, ...partial };
        if (partial.fontSize && partial.fontSize in FONT_SCALES) {
          newAppearance.fontScale = FONT_SCALES[partial.fontSize as keyof typeof FONT_SCALES];
        }
        
        set((state) => ({
          settings: {
            ...state.settings,
            appearance: newAppearance,
          },
        }));
        
        // Apply the font scale to CSS
        get().applyFontScale();
      },

      applyFontScale: () => {
        if (typeof document !== 'undefined') {
          // Defensive: ensure appearance exists with defaults
          const appearance = get().settings?.appearance ?? defaultAppearance;
          const { fontScale = 1, compactMode = false } = appearance;
          
          document.documentElement.style.setProperty('--font-scale', String(fontScale));
          
          // Apply compact mode
          if (compactMode) {
            document.documentElement.classList.add('compact-mode');
          } else {
            document.documentElement.classList.remove('compact-mode');
          }
        }
      },

      resetSettings: () => {
        set({ settings: defaultSettings });
        get().applyFontScale();
      },
    }),
    {
      name: 'ars-technicai-settings',
      // Version for migrations
      version: 1,
      // Deep merge stored state with defaults to handle missing properties
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<SettingsState> | undefined;
        if (!persisted || !persisted.settings) {
          return currentState;
        }
        
        // Deep merge settings with defaults
        return {
          ...currentState,
          settings: {
            ...defaultSettings,
            ...persisted.settings,
            // Ensure nested objects are properly merged with defaults
            appearance: {
              ...defaultAppearance,
              ...(persisted.settings.appearance ?? {}),
            },
            aiProvider: {
              ...defaultAIProvider,
              ...(persisted.settings.aiProvider ?? {}),
            },
          },
        };
      },
      onRehydrateStorage: () => (state) => {
        // Apply font scale after rehydration
        if (state) {
          state.applyFontScale();
        }
      },
    }
  )
);
