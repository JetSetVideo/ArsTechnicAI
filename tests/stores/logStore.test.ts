/**
 * Log Store Unit Tests
 * 
 * Tests for action logging functionality including:
 * - Log entry creation
 * - Log types and metadata
 * - Log limit enforcement
 * - Log clearing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mock-log-' + Math.random().toString(36).substr(2, 9),
}));

import { useLogStore } from '../../stores/logStore';

describe('LogStore', () => {
  beforeEach(() => {
    // Clear all logs - note: method is clearLog not clearLogs
    useLogStore.getState().clearLog();
  });

  describe('Log Entry Creation', () => {
    it('should log an action', () => {
      const store = useLogStore.getState();
      
      store.log('file_import', 'Imported test.png');
      
      const state = useLogStore.getState();
      expect(state.entries).toHaveLength(1);
      expect(state.entries[0].type).toBe('file_import');
      expect(state.entries[0].description).toBe('Imported test.png');
    });

    it('should log with metadata', () => {
      const store = useLogStore.getState();
      
      store.log('generation_start', 'Started generation', {
        prompt: 'A beautiful sunset',
        width: 1024,
        height: 1024,
      });
      
      const state = useLogStore.getState();
      expect(state.entries[0].data).toBeDefined();
      expect(state.entries[0].data?.prompt).toBe('A beautiful sunset');
      expect(state.entries[0].data?.width).toBe(1024);
    });

    it('should add timestamp to log entries', () => {
      const store = useLogStore.getState();
      const beforeLog = Date.now();
      
      store.log('canvas_add', 'Added item to canvas');
      
      const state = useLogStore.getState();
      const afterLog = Date.now();
      
      expect(state.entries[0].timestamp).toBeGreaterThanOrEqual(beforeLog);
      expect(state.entries[0].timestamp).toBeLessThanOrEqual(afterLog);
    });

    it('should generate unique IDs for log entries', () => {
      const store = useLogStore.getState();
      
      store.log('canvas_add', 'Item 1');
      store.log('canvas_add', 'Item 2');
      
      const state = useLogStore.getState();
      expect(state.entries[0].id).not.toBe(state.entries[1].id);
    });
  });

  describe('Log Types', () => {
    const logTypes = [
      'file_import',
      'file_export',
      'canvas_add',
      'canvas_remove',
      'canvas_move',
      'canvas_resize',
      'generation_start',
      'generation_complete',
      'generation_fail',
      'prompt_save',
      'settings_change',
      'search',
      'folder_create',
      'folder_open',
    ] as const;

    it.each(logTypes)('should accept log type: %s', (type) => {
      const store = useLogStore.getState();
      
      store.log(type, `Test ${type}`);
      
      const state = useLogStore.getState();
      expect(state.entries[0].type).toBe(type);
    });
  });

  describe('Log Ordering', () => {
    it('should maintain newest-first order', () => {
      const store = useLogStore.getState();
      
      store.log('canvas_add', 'First');
      store.log('canvas_add', 'Second');
      store.log('canvas_add', 'Third');
      
      const state = useLogStore.getState();
      expect(state.entries[0].description).toBe('Third');
      expect(state.entries[1].description).toBe('Second');
      expect(state.entries[2].description).toBe('First');
    });
  });

  describe('Log Limit Enforcement', () => {
    it('should enforce maximum log entries', () => {
      const store = useLogStore.getState();
      const MAX_LOGS = store.maxEntries;
      
      // Add more than the limit
      for (let i = 0; i < MAX_LOGS + 50; i++) {
        store.log('canvas_add', `Entry ${i}`);
      }
      
      const state = useLogStore.getState();
      expect(state.entries.length).toBeLessThanOrEqual(MAX_LOGS);
    });

    it('should remove oldest entries when limit reached', () => {
      const store = useLogStore.getState();
      
      // Add entries up to limit
      for (let i = 0; i < store.maxEntries; i++) {
        store.log('canvas_add', `Entry ${i}`);
      }
      
      // Add one more
      store.log('canvas_add', 'Newest Entry');
      
      const state = useLogStore.getState();
      expect(state.entries[0].description).toBe('Newest Entry');
      // First entry should have been removed
      expect(state.entries.find(l => l.description === 'Entry 0')).toBeUndefined();
    });
  });

  describe('Log Clearing', () => {
    it('should clear all logs', () => {
      const store = useLogStore.getState();
      
      store.log('canvas_add', 'Item 1');
      store.log('canvas_add', 'Item 2');
      store.log('canvas_add', 'Item 3');
      
      expect(useLogStore.getState().entries).toHaveLength(3);
      
      store.clearLog();
      
      expect(useLogStore.getState().entries).toHaveLength(0);
    });
  });

  describe('Undoable Flag', () => {
    it('should accept undoable flag on log entries', () => {
      const store = useLogStore.getState();
      
      store.log('canvas_add', 'Added item', undefined, true);
      
      const state = useLogStore.getState();
      expect(state.entries[0].undoable).toBe(true);
    });

    it('should default undoable to false', () => {
      const store = useLogStore.getState();
      
      store.log('settings_change', 'Changed theme');
      
      const state = useLogStore.getState();
      expect(state.entries[0].undoable).toBe(false);
    });
  });

  describe('Generation Count', () => {
    it('should track generation count via filtering', () => {
      const store = useLogStore.getState();
      
      store.log('generation_complete', 'Generated image 1');
      store.log('generation_complete', 'Generated image 2');
      store.log('generation_complete', 'Generated image 3');
      
      const state = useLogStore.getState();
      const generationCount = state.entries.filter(
        l => l.type === 'generation_complete'
      ).length;
      
      expect(generationCount).toBe(3);
    });
  });

  describe('Helper Methods', () => {
    it('should get recent entries', () => {
      const store = useLogStore.getState();
      
      store.log('canvas_add', 'Entry 1');
      store.log('canvas_add', 'Entry 2');
      store.log('canvas_add', 'Entry 3');
      
      const recent = store.getRecentEntries(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].description).toBe('Entry 3');
    });

    it('should get entries by type', () => {
      const store = useLogStore.getState();
      
      store.log('canvas_add', 'Canvas 1');
      store.log('settings_change', 'Setting 1');
      store.log('canvas_add', 'Canvas 2');
      
      const canvasEntries = store.getEntriesByType('canvas_add');
      expect(canvasEntries).toHaveLength(2);
      expect(canvasEntries.every(e => e.type === 'canvas_add')).toBe(true);
    });
  });
});
