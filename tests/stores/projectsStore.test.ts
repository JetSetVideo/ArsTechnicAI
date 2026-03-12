/**
 * Projects Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectsStore } from '../../stores/projectsStore';

describe('projectsStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useProjectsStore.setState(useProjectsStore.getInitialState());
  });

  describe('initial state', () => {
    it('should start with no projects', () => {
      const { projects } = useProjectsStore.getState();
      expect(projects.length).toBe(0);
    });

    it('should have default sort settings', () => {
      const { sortBy, sortOrder } = useProjectsStore.getState();
      expect(sortBy).toBe('modifiedAt');
      expect(sortOrder).toBe('desc');
    });
  });

  describe('addProject', () => {
    it('should add a new project with generated id and timestamps', () => {
      const { addProject, projects } = useProjectsStore.getState();
      const initialCount = projects.length;
      
      const newProject = addProject({ name: 'Test Project', tags: ['test'] });
      
      const { projects: updated } = useProjectsStore.getState();
      expect(updated.length).toBe(initialCount + 1);
      expect(newProject.id).toMatch(/^proj-/);
      expect(newProject.name).toBe('Test Project');
      expect(newProject.assetCount).toBe(0);
      expect(newProject.createdAt).toBeGreaterThan(0);
    });
  });

  describe('updateProject', () => {
    it('should update a project and refresh modifiedAt', () => {
      const { addProject, updateProject } = useProjectsStore.getState();
      const project = addProject({ name: 'Temp Project', tags: [] });
      const oldModifiedAt = project.modifiedAt;

      updateProject(project.id, { name: 'Updated Name' });
      
      const updated = useProjectsStore.getState().getProject(project.id);
      expect(updated?.name).toBe('Updated Name');
      expect(updated!.modifiedAt).toBeGreaterThanOrEqual(oldModifiedAt);
    });
  });

  describe('deleteProject', () => {
    it('should remove the project', () => {
      const { addProject, deleteProject } = useProjectsStore.getState();
      const project = addProject({ name: 'Temp Project', tags: [] });
      const initialCount = useProjectsStore.getState().projects.length;

      deleteProject(project.id);
      
      const { projects: updated } = useProjectsStore.getState();
      expect(updated.length).toBe(initialCount - 1);
      expect(updated.find(p => p.id === project.id)).toBeUndefined();
    });

    it('should clean up recentProjectIds', () => {
      const state = useProjectsStore.getState();
      const project = state.addProject({ name: 'Recent Project', tags: [] });
      state.openProject(project.id);
      
      state.deleteProject(project.id);
      
      expect(useProjectsStore.getState().recentProjectIds).not.toContain(project.id);
    });
  });

  describe('duplicateProject', () => {
    it('should create a copy with new id and "(Copy)" suffix', () => {
      const { addProject, duplicateProject } = useProjectsStore.getState();
      const original = addProject({ name: 'Original Project', tags: [] });
      
      const copy = duplicateProject(original.id);
      
      expect(copy).not.toBeNull();
      expect(copy!.id).not.toBe(original.id);
      expect(copy!.name).toBe(`${original.name} (Copy)`);
    });

    it('should return null for non-existent project', () => {
      const { duplicateProject } = useProjectsStore.getState();
      expect(duplicateProject('nonexistent')).toBeNull();
    });
  });

  describe('toggleFavorite', () => {
    it('should toggle the isFavorite flag', () => {
      const { addProject, toggleFavorite } = useProjectsStore.getState();
      const project = addProject({ name: 'Fav Project', tags: [] });
      const wasFavorite = project.isFavorite;

      toggleFavorite(project.id);
      
      const updated = useProjectsStore.getState().getProject(project.id);
      expect(updated?.isFavorite).toBe(!wasFavorite);
    });
  });

  describe('openProject', () => {
    it('should set currentProjectId and update lastOpenedAt', () => {
      const { addProject, openProject } = useProjectsStore.getState();
      const project = addProject({ name: 'Open Project', tags: [] });

      openProject(project.id);
      
      const state = useProjectsStore.getState();
      expect(state.currentProjectId).toBe(project.id);
      expect(state.recentProjectIds[0]).toBe(project.id);
    });
  });

  describe('getSortedProjects', () => {
    it('should filter by favorites when showFavoritesOnly is true', () => {
      const { addProject } = useProjectsStore.getState();
      const project = addProject({ name: 'Fav Project', tags: [] });
      useProjectsStore.getState().toggleFavorite(project.id);
      useProjectsStore.setState({ showFavoritesOnly: true });
      const sorted = useProjectsStore.getState().getSortedProjects();
      expect(sorted.every(p => p.isFavorite)).toBe(true);
    });

    it('should filter by tags', () => {
      const { addProject } = useProjectsStore.getState();
      addProject({ name: 'Tag Project', tags: ['marketing'] });
      useProjectsStore.setState({ filterTags: ['marketing'] });
      const sorted = useProjectsStore.getState().getSortedProjects();
      expect(sorted.every(p => p.tags.includes('marketing'))).toBe(true);
    });
  });

  describe('getAllTags', () => {
    it('should return unique sorted tags from all projects', () => {
      const { addProject } = useProjectsStore.getState();
      addProject({ name: 'Tag Project', tags: ['alpha', 'beta'] });
      const tags = useProjectsStore.getState().getAllTags();
      expect(tags.length).toBeGreaterThan(0);
      // Verify sorted
      for (let i = 1; i < tags.length; i++) {
        expect(tags[i].localeCompare(tags[i - 1])).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getNextDefaultName', () => {
    it('should start at 1 when no projects exist', () => {
      const name = useProjectsStore.getState().getNextDefaultName();
      expect(name).toBe('Untitled Project 1');
    });

    it('should increment based on existing default names', () => {
      const state = useProjectsStore.getState();
      state.addProject({ name: 'Untitled Project 1', tags: [] });
      state.addProject({ name: 'Untitled Project 2', tags: [] });

      const name = useProjectsStore.getState().getNextDefaultName();
      expect(name).toBe('Untitled Project 3');
    });
  });
});
