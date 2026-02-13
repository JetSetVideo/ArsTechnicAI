/**
 * Settings Store Unit Tests
 * 
 * Tests for application settings management including:
 * - Theme settings
 * - AI provider configuration
 * - Appearance settings
 * - Settings persistence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import the store
import { useSettingsStore } from '../../stores/settingsStore';

describe('SettingsStore', () => {
  beforeEach(() => {
    // Reset the store to default state
    useSettingsStore.getState().resetSettings();
  });

  describe('General Settings', () => {
    it('should have default settings', () => {
      const state = useSettingsStore.getState();
      
      expect(state.settings.theme).toBe('dark');
      expect(state.settings.showGrid).toBe(true);
      expect(state.settings.snapToGrid).toBe(false);
      expect(state.settings.gridSize).toBe(20);
      expect(state.settings.autoSavePrompts).toBe(true);
    });

    it('should update general settings', () => {
      const store = useSettingsStore.getState();
      
      store.updateSettings({
        theme: 'light',
        showGrid: false,
        snapToGrid: true,
      });
      
      const state = useSettingsStore.getState();
      expect(state.settings.theme).toBe('light');
      expect(state.settings.showGrid).toBe(false);
      expect(state.settings.snapToGrid).toBe(true);
    });

    it('should partially update settings', () => {
      const store = useSettingsStore.getState();
      const originalGridSize = store.settings.gridSize;
      
      store.updateSettings({ theme: 'system' });
      
      const state = useSettingsStore.getState();
      expect(state.settings.theme).toBe('system');
      expect(state.settings.gridSize).toBe(originalGridSize);
    });
  });

  describe('AI Provider Settings', () => {
    it('should have default AI provider settings', () => {
      const state = useSettingsStore.getState();
      
      expect(state.settings.aiProvider.provider).toBe('nanobanana');
      expect(state.settings.aiProvider.model).toBe('imagen-3.0-generate-002');
      expect(state.settings.aiProvider.defaultWidth).toBe(1024);
      expect(state.settings.aiProvider.defaultHeight).toBe(1024);
    });

    it('should update AI provider settings', () => {
      const store = useSettingsStore.getState();
      
      store.updateAIProvider({
        apiKey: 'test-api-key',
        model: 'custom-model',
      });
      
      const state = useSettingsStore.getState();
      expect(state.settings.aiProvider.apiKey).toBe('test-api-key');
      expect(state.settings.aiProvider.model).toBe('custom-model');
    });

    it('should update default dimensions', () => {
      const store = useSettingsStore.getState();
      
      store.updateAIProvider({
        defaultWidth: 512,
        defaultHeight: 768,
      });
      
      const state = useSettingsStore.getState();
      expect(state.settings.aiProvider.defaultWidth).toBe(512);
      expect(state.settings.aiProvider.defaultHeight).toBe(768);
    });

    it('should preserve other AI settings when updating', () => {
      const store = useSettingsStore.getState();
      store.updateAIProvider({ apiKey: 'initial-key' });
      
      store.updateAIProvider({ model: 'new-model' });
      
      const state = useSettingsStore.getState();
      expect(state.settings.aiProvider.apiKey).toBe('initial-key');
      expect(state.settings.aiProvider.model).toBe('new-model');
    });
  });

  describe('Appearance Settings', () => {
    it('should have default appearance settings', () => {
      const state = useSettingsStore.getState();
      
      expect(state.settings.appearance.fontSize).toBe('medium');
      expect(state.settings.appearance.fontScale).toBe(1);
      expect(state.settings.appearance.compactMode).toBe(false);
      expect(state.settings.appearance.showFilenames).toBe(true);
    });

    it('should update font size and calculate scale', () => {
      const store = useSettingsStore.getState();
      
      store.updateAppearance({ fontSize: 'small' });
      
      const state = useSettingsStore.getState();
      expect(state.settings.appearance.fontSize).toBe('small');
      expect(state.settings.appearance.fontScale).toBe(0.875);
    });

    it('should update to large font size', () => {
      const store = useSettingsStore.getState();
      
      store.updateAppearance({ fontSize: 'large' });
      
      const state = useSettingsStore.getState();
      expect(state.settings.appearance.fontSize).toBe('large');
      expect(state.settings.appearance.fontScale).toBe(1.125);
    });

    it('should toggle compact mode', () => {
      const store = useSettingsStore.getState();
      
      store.updateAppearance({ compactMode: true });
      
      expect(useSettingsStore.getState().settings.appearance.compactMode).toBe(true);
      
      store.updateAppearance({ compactMode: false });
      
      expect(useSettingsStore.getState().settings.appearance.compactMode).toBe(false);
    });

    it('should toggle filename visibility', () => {
      const store = useSettingsStore.getState();
      
      store.updateAppearance({ showFilenames: false });
      
      expect(useSettingsStore.getState().settings.appearance.showFilenames).toBe(false);
    });
  });

  describe('Reset Settings', () => {
    it('should reset all settings to defaults', () => {
      const store = useSettingsStore.getState();
      
      // Modify various settings
      store.updateSettings({ theme: 'light', showGrid: false });
      store.updateAIProvider({ apiKey: 'some-key', model: 'custom' });
      store.updateAppearance({ fontSize: 'large', compactMode: true });
      
      // Reset
      store.resetSettings();
      
      const state = useSettingsStore.getState();
      expect(state.settings.theme).toBe('dark');
      expect(state.settings.showGrid).toBe(true);
      expect(state.settings.aiProvider.apiKey).toBe('');
      expect(state.settings.aiProvider.model).toBe('imagen-3.0-generate-002');
      expect(state.settings.appearance.fontSize).toBe('medium');
      expect(state.settings.appearance.compactMode).toBe(false);
    });
  });

  describe('Font Scale Application', () => {
    it('should apply font scale to document', () => {
      // Mock document
      const mockSetProperty = vi.fn();
      const mockClassList = {
        add: vi.fn(),
        remove: vi.fn(),
      };
      
      Object.defineProperty(global, 'document', {
        value: {
          documentElement: {
            style: { setProperty: mockSetProperty },
            classList: mockClassList,
          },
        },
        writable: true,
      });
      
      const store = useSettingsStore.getState();
      store.applyFontScale();
      
      expect(mockSetProperty).toHaveBeenCalledWith('--font-scale', '1');
    });
  });
});
