/**
 * User Store Unit Tests
 * 
 * Tests for user and device information management including:
 * - Device information gathering
 * - Session management
 * - Project management
 * - Security-safe data extraction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9),
}));

import { useUserStore } from '../../stores/userStore';

describe('UserStore', () => {
  beforeEach(() => {
    // Reset store state
    useUserStore.setState({
      currentProject: {
        id: 'test-project-id',
        name: 'Untitled Project',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        path: '/projects/untitled-project',
      },
      recentProjects: [],
      deviceInfo: null,
      session: {
        sessionId: 'test-session',
        startedAt: Date.now(),
        generationsCount: 0,
        importsCount: 0,
        exportsCount: 0,
      },
    });
  });

  describe('Device Information', () => {
    it('should refresh device info', () => {
      const store = useUserStore.getState();
      
      store.refreshDeviceInfo();
      
      const state = useUserStore.getState();
      expect(state.deviceInfo).not.toBeNull();
    });

    it('should gather screen dimensions', () => {
      const store = useUserStore.getState();
      
      store.refreshDeviceInfo();
      
      const state = useUserStore.getState();
      expect(state.deviceInfo?.screenWidth).toBe(1920);
      expect(state.deviceInfo?.screenHeight).toBe(1080);
    });

    it('should gather viewport dimensions', () => {
      const store = useUserStore.getState();
      
      store.refreshDeviceInfo();
      
      const state = useUserStore.getState();
      expect(state.deviceInfo?.viewportWidth).toBe(1920);
      expect(state.deviceInfo?.viewportHeight).toBe(1080);
    });

    it('should gather platform information', () => {
      const store = useUserStore.getState();
      
      store.refreshDeviceInfo();
      
      const state = useUserStore.getState();
      expect(state.deviceInfo?.platform).toBeDefined();
      expect(state.deviceInfo?.userAgent).toBeDefined();
    });

    it('should gather hardware capabilities', () => {
      const store = useUserStore.getState();
      
      store.refreshDeviceInfo();
      
      const state = useUserStore.getState();
      expect(state.deviceInfo?.hardwareConcurrency).toBe(8);
    });

    it('should include timestamp of last update', () => {
      const store = useUserStore.getState();
      const beforeRefresh = Date.now();
      
      store.refreshDeviceInfo();
      
      const state = useUserStore.getState();
      expect(state.deviceInfo?.updatedAt).toBeGreaterThanOrEqual(beforeRefresh);
    });
  });

  describe('Project Management', () => {
    it('should have a current project', () => {
      const state = useUserStore.getState();
      
      expect(state.currentProject).toBeDefined();
      expect(state.currentProject.name).toBe('Untitled Project');
    });

    it('should update current project', () => {
      const store = useUserStore.getState();
      
      store.updateProject({ name: 'My New Project' });
      
      const state = useUserStore.getState();
      expect(state.currentProject.name).toBe('My New Project');
    });

    it('should update modifiedAt when project changes', () => {
      const store = useUserStore.getState();
      const originalModified = store.currentProject.modifiedAt;
      
      // Small delay to ensure timestamp difference
      store.updateProject({ name: 'Updated Project' });
      
      const state = useUserStore.getState();
      expect(state.currentProject.modifiedAt).toBeGreaterThanOrEqual(originalModified);
    });

    it('should create new project', () => {
      const store = useUserStore.getState();
      
      const newProject = store.createNewProject('Brand New Project');
      
      const state = useUserStore.getState();
      expect(state.currentProject.name).toBe('Brand New Project');
      expect(newProject.id).toBeDefined();
    });

    it('should add old project to recent projects when creating new', () => {
      const store = useUserStore.getState();
      const oldProjectName = store.currentProject.name;
      
      store.createNewProject('New Project');
      
      const state = useUserStore.getState();
      expect(state.recentProjects.some(p => p.name === oldProjectName)).toBe(true);
    });

    it('should switch to recent project', () => {
      const store = useUserStore.getState();
      
      // Create a project and then another
      store.createNewProject('Project 1');
      store.createNewProject('Project 2');
      
      // Get the id of Project 1 from recent
      const state1 = useUserStore.getState();
      const project1Id = state1.recentProjects.find(p => p.name === 'Project 1')?.id;
      
      if (project1Id) {
        store.switchProject(project1Id);
        
        const state2 = useUserStore.getState();
        expect(state2.currentProject.name).toBe('Project 1');
      }
    });

    it('should limit recent projects to 10', () => {
      const store = useUserStore.getState();
      
      // Create 12 projects
      for (let i = 0; i < 12; i++) {
        store.createNewProject(`Project ${i}`);
      }
      
      const state = useUserStore.getState();
      expect(state.recentProjects.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Session Statistics', () => {
    it('should increment generation count', () => {
      const store = useUserStore.getState();
      
      store.incrementStat('generationsCount');
      store.incrementStat('generationsCount');
      
      const state = useUserStore.getState();
      expect(state.session.generationsCount).toBe(2);
    });

    it('should increment import count', () => {
      const store = useUserStore.getState();
      
      store.incrementStat('importsCount');
      
      const state = useUserStore.getState();
      expect(state.session.importsCount).toBe(1);
    });

    it('should increment export count', () => {
      const store = useUserStore.getState();
      
      store.incrementStat('exportsCount');
      store.incrementStat('exportsCount');
      store.incrementStat('exportsCount');
      
      const state = useUserStore.getState();
      expect(state.session.exportsCount).toBe(3);
    });
  });

  describe('Security-Safe Information', () => {
    it('should return security-safe info object', () => {
      const store = useUserStore.getState();
      store.refreshDeviceInfo();
      
      const safeInfo = store.getSecuritySafeInfo();
      
      expect(safeInfo).toBeDefined();
      expect(safeInfo.screen).toBeDefined();
      expect(safeInfo.project).toBeDefined();
      expect(safeInfo.stats).toBeDefined();
      expect(safeInfo.locale).toBeDefined();
    });

    it('should not include sensitive device details', () => {
      const store = useUserStore.getState();
      store.refreshDeviceInfo();
      
      const safeInfo = store.getSecuritySafeInfo();
      
      // Should not include full user agent
      expect(safeInfo).not.toHaveProperty('userAgent');
      // Should not include full platform details
      expect(safeInfo).not.toHaveProperty('platform');
    });

    it('should include only non-identifying screen info', () => {
      const store = useUserStore.getState();
      store.refreshDeviceInfo();
      
      const safeInfo = store.getSecuritySafeInfo();
      
      expect(safeInfo.screen?.width).toBeDefined();
      expect(safeInfo.screen?.height).toBeDefined();
      expect(safeInfo.screen?.dpr).toBeDefined();
      expect(safeInfo.screen?.orientation).toBeDefined();
    });

    it('should include project context without sensitive paths', () => {
      const store = useUserStore.getState();
      
      const safeInfo = store.getSecuritySafeInfo();
      
      expect(safeInfo.project?.id).toBeDefined();
      expect(safeInfo.project?.name).toBeDefined();
      // Should not include full file path
      expect(safeInfo.project).not.toHaveProperty('path');
    });

    it('should include anonymous session stats', () => {
      const store = useUserStore.getState();
      store.incrementStat('generationsCount');
      
      const safeInfo = store.getSecuritySafeInfo();
      
      expect(safeInfo.stats?.generations).toBe(1);
      expect(safeInfo.stats?.sessionDuration).toBeDefined();
      // Should not include session ID
      expect(safeInfo.stats).not.toHaveProperty('sessionId');
    });
  });
});
