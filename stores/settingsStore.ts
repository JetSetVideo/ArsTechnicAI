import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, AIProviderSettings, AppearanceSettings } from '@/types';
import { STORAGE_KEYS } from '@/constants/workspace';

export const RECOMMENDED_GENERATION_MODELS = [
  'imagen-3.0-generate-002',
  'imagen-4.0-fast-generate-001',
  'imagen-4.0-generate-001',
  'imagen-4.0-ultra-generate-001',
] as const;

export function getRecommendedModelFallbacks(currentModel: string): string[] {
  const normalized = (currentModel || '').trim();
  const ordered = RECOMMENDED_GENERATION_MODELS.filter((model) => model !== normalized);
  return [...ordered];
}

// Default model per provider
export const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  GOOGLE_IMAGEN: 'imagen-3.0-generate-002',
  OPENAI_DALLE: 'dall-e-3',
  STABILITY: 'sd3.5-large',
  FAL: 'fal-ai/flux/schnell',
  REPLICATE: 'black-forest-labs/flux-schnell',
};

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
  activeProvider: 'GOOGLE_IMAGEN',
  activeModel: 'imagen-3.0-generate-002',
  apiKeys: {},
  defaultWidth: 1024,
  defaultHeight: 1024,
  defaultSteps: 28,
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
  groupingDelay: 800,
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
      name: STORAGE_KEYS.settings,
      // Version for migrations
      version: 2,
      // Deep merge stored state with defaults to handle missing properties
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<SettingsState> | undefined;
        if (!persisted || !persisted.settings) {
          return currentState;
        }

        const oldAI = persisted.settings.aiProvider as Record<string, unknown> | undefined ?? {};

        // Migrate from legacy single-key format (v1) to per-provider keys (v2)
        let mergedAiProvider = { ...defaultAIProvider, ...oldAI } as AIProviderSettings;
        if (!mergedAiProvider.activeProvider) {
          // Old format had `provider` (string) and `apiKey` (string)
          const legacyProvider = (oldAI.provider as string) ?? '';
          const legacyKey = (oldAI.apiKey as string) ?? '';
          const providerMap: Record<string, string> = {
            nanobanana: 'GOOGLE_IMAGEN',
            openai: 'OPENAI_DALLE',
            stability: 'STABILITY',
            midjourney: 'MIDJOURNEY',
            custom: 'CUSTOM',
          };
          const mapped = providerMap[legacyProvider] ?? 'GOOGLE_IMAGEN';
          mergedAiProvider = {
            ...defaultAIProvider,
            activeProvider: mapped as AIProviderSettings['activeProvider'],
            activeModel: (oldAI.model as string) || PROVIDER_DEFAULT_MODELS[mapped] || 'imagen-3.0-generate-002',
            apiKeys: legacyKey ? { [mapped]: legacyKey } as AIProviderSettings['apiKeys'] : {},
          };
        }
        // Ensure apiKeys object always exists
        if (!mergedAiProvider.apiKeys) mergedAiProvider.apiKeys = {};

        // Deep merge settings with defaults
        return {
          ...currentState,
          settings: {
            ...defaultSettings,
            ...persisted.settings,
            appearance: {
              ...defaultAppearance,
              ...(persisted.settings.appearance ?? {}),
            },
            aiProvider: mergedAiProvider,
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
