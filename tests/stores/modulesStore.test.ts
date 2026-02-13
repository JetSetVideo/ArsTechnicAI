/**
 * Modules Store Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useModulesStore } from '../../stores/modulesStore';

describe('modulesStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useModulesStore.setState(useModulesStore.getInitialState());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should have preinstalled modules active by default', () => {
      const preinstalled = useModulesStore.getState().getPreinstalledModules();
      expect(preinstalled.length).toBe(6);
      expect(preinstalled.every(m => m.status === 'active')).toBe(true);
    });

    it('should have available modules', () => {
      const available = useModulesStore.getState().getAvailableModules();
      expect(available.length).toBe(10);
      expect(available.every(m => m.status === 'available')).toBe(true);
    });
  });

  describe('getModule', () => {
    it('should find a module by id', () => {
      const module = useModulesStore.getState().getModule('image-gen');
      expect(module).toBeDefined();
      expect(module!.name).toBe('Image Generation');
    });

    it('should return undefined for unknown id', () => {
      expect(useModulesStore.getState().getModule('nonexistent')).toBeUndefined();
    });
  });

  describe('activateModule / deactivateModule', () => {
    it('should deactivate an active preinstalled module', () => {
      const { deactivateModule } = useModulesStore.getState();
      deactivateModule('image-gen');
      
      const module = useModulesStore.getState().getModule('image-gen');
      expect(module!.status).toBe('inactive');
    });

    it('should activate an inactive module', () => {
      const state = useModulesStore.getState();
      state.deactivateModule('image-gen');
      
      useModulesStore.getState().activateModule('image-gen');
      
      const module = useModulesStore.getState().getModule('image-gen');
      expect(module!.status).toBe('active');
    });

    it('should not activate an available (not installed) module', () => {
      const { activateModule } = useModulesStore.getState();
      activateModule('camera-move');
      
      const module = useModulesStore.getState().getModule('camera-move');
      expect(module!.status).toBe('available');
    });
  });

  describe('installModule', () => {
    it('should start download and update progress', () => {
      const { installModule } = useModulesStore.getState();
      installModule('camera-move');
      
      const module = useModulesStore.getState().getModule('camera-move');
      expect(module!.status).toBe('downloading');
      expect(module!.downloadProgress).toBe(0);
      expect(useModulesStore.getState().downloadQueue).toContain('camera-move');
    });

    it('should complete download after progress reaches 100%', () => {
      const { installModule } = useModulesStore.getState();
      installModule('camera-move');
      
      // Run enough intervals to complete
      for (let i = 0; i < 20; i++) {
        vi.advanceTimersByTime(500);
      }
      
      const module = useModulesStore.getState().getModule('camera-move');
      expect(module!.status).toBe('inactive');
      expect(module!.installedAt).toBeGreaterThan(0);
      expect(useModulesStore.getState().downloadQueue).not.toContain('camera-move');
    });

    it('should not install a preinstalled module', () => {
      const { installModule } = useModulesStore.getState();
      installModule('image-gen');
      
      const module = useModulesStore.getState().getModule('image-gen');
      expect(module!.status).toBe('active');
    });
  });

  describe('uninstallModule', () => {
    it('should cancel download and reset to available', () => {
      const state = useModulesStore.getState();
      state.installModule('camera-move');
      
      useModulesStore.getState().uninstallModule('camera-move');
      
      const module = useModulesStore.getState().getModule('camera-move');
      expect(module!.status).toBe('available');
      expect(module!.downloadProgress).toBeUndefined();
      expect(useModulesStore.getState().downloadQueue).not.toContain('camera-move');
    });

    it('should not uninstall preinstalled modules', () => {
      const { uninstallModule } = useModulesStore.getState();
      uninstallModule('image-gen');
      
      const module = useModulesStore.getState().getModule('image-gen');
      expect(module!.status).toBe('active');
    });
  });

  describe('searchModules', () => {
    it('should find modules by name', () => {
      const results = useModulesStore.getState().searchModules('camera');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(m => m.id === 'camera-move')).toBe(true);
    });

    it('should find modules by tag', () => {
      const results = useModulesStore.getState().searchModules('animation');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty for no matches', () => {
      const results = useModulesStore.getState().searchModules('zzzznonexistent');
      expect(results.length).toBe(0);
    });
  });

  describe('isModuleActive / isModuleInstalled', () => {
    it('should report preinstalled modules as active and installed', () => {
      const state = useModulesStore.getState();
      expect(state.isModuleActive('image-gen')).toBe(true);
      expect(state.isModuleInstalled('image-gen')).toBe(true);
    });

    it('should report available modules as not active and not installed', () => {
      const state = useModulesStore.getState();
      expect(state.isModuleActive('camera-move')).toBe(false);
      expect(state.isModuleInstalled('camera-move')).toBe(false);
    });
  });
});
