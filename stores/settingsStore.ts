import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, AIProviderSettings } from '@/types';

interface SettingsState {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  updateAIProvider: (partial: Partial<AIProviderSettings>) => void;
  resetSettings: () => void;
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  aiProvider: {
    provider: 'nanobanana',
    apiKey: '',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'imagen-3.0-generate-001',
    defaultWidth: 1024,
    defaultHeight: 1024,
    defaultSteps: 50,
    defaultGuidanceScale: 7.5,
  },
  outputDirectory: './generated',
  autoSavePrompts: true,
  showGrid: true,
  snapToGrid: false,
  gridSize: 20,
  recentPaths: [],
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,

      updateSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),

      updateAIProvider: (partial) =>
        set((state) => ({
          settings: {
            ...state.settings,
            aiProvider: { ...state.settings.aiProvider, ...partial },
          },
        })),

      resetSettings: () => set({ settings: defaultSettings }),
    }),
    {
      name: 'ars-technicai-settings',
    }
  )
);
