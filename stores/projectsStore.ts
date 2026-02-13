/**
 * Projects Store
 * 
 * Manages dashboard projects with thumbnails, stats, and recent projects list.
 * Persisted to localStorage for offline access.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { persist } from 'zustand/middleware';
import type { DashboardProject } from '../types/dashboard';
import { STORAGE_KEYS } from '@/constants/workspace';

// ============================================
// STORE INTERFACE
// ============================================

interface ProjectsState {
  projects: DashboardProject[];
  currentProjectId: string | null;
  recentProjectIds: string[];
  sortBy: 'name' | 'modifiedAt' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  filterTags: string[];
  showFavoritesOnly: boolean;
}

interface ProjectsActions {
  // Project CRUD
  addProject: (project: Omit<DashboardProject, 'id' | 'createdAt' | 'modifiedAt' | 'assetCount'>) => DashboardProject;
  updateProject: (id: string, updates: Partial<DashboardProject>) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => DashboardProject | null;
  
  // Project selection
  setCurrentProject: (id: string | null) => void;
  openProject: (id: string) => void;
  
  // Favorites
  toggleFavorite: (id: string) => void;
  
  // Sorting and filtering
  setSortBy: (sortBy: ProjectsState['sortBy']) => void;
  setSortOrder: (order: ProjectsState['sortOrder']) => void;
  setFilterTags: (tags: string[]) => void;
  toggleShowFavoritesOnly: () => void;
  
  // Getters
  getProject: (id: string) => DashboardProject | undefined;
  getRecentProjects: (limit?: number) => DashboardProject[];
  getFavoriteProjects: () => DashboardProject[];
  getSortedProjects: () => DashboardProject[];
  getAllTags: () => string[];
  getNextDefaultName: (baseName?: string) => string;
}

type ProjectsStore = ProjectsState & ProjectsActions;

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useProjectsStore = create<ProjectsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      projects: [],
      currentProjectId: null,
      recentProjectIds: [],
      sortBy: 'modifiedAt',
      sortOrder: 'desc',
      filterTags: [],
      showFavoritesOnly: false,

      // Project CRUD
      addProject: (projectData) => {
        const newProject: DashboardProject = {
          id: `proj-${uuidv4()}`,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          assetCount: 0,
          isFavorite: false,
          ...projectData,
        };
        
        // Prevent duplicates by ID
        const existing = get().projects.find((p) => p.id === newProject.id);
        if (existing) return existing;

        set((state) => ({
          projects: [newProject, ...state.projects.filter((p) => p.id !== newProject.id)],
        }));
        
        return newProject;
      },

      updateProject: (id, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id
              ? { ...p, ...updates, modifiedAt: Date.now() }
              : p
          ),
        }));
      },

      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          recentProjectIds: state.recentProjectIds.filter((rid) => rid !== id),
          currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
        }));
      },

      duplicateProject: (id) => {
        const original = get().getProject(id);
        if (!original) return null;
        
        const duplicate: DashboardProject = {
          ...original,
          id: `proj-${uuidv4()}`,
          name: `${original.name} (Copy)`,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          isFavorite: false,
        };
        
        set((state) => ({
          projects: [duplicate, ...state.projects],
        }));
        
        return duplicate;
      },

      // Project selection
      setCurrentProject: (id) => {
        set({ currentProjectId: id });
      },

      openProject: (id) => {
        const project = get().getProject(id);
        if (!project) return;
        
        set((state) => {
          const recentIds = [id, ...state.recentProjectIds.filter((rid) => rid !== id)].slice(0, 10);
          return {
            currentProjectId: id,
            recentProjectIds: recentIds,
            projects: state.projects.map((p) =>
              p.id === id ? { ...p, lastOpenedAt: Date.now() } : p
            ),
          };
        });
      },

      // Favorites
      toggleFavorite: (id) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, isFavorite: !p.isFavorite } : p
          ),
        }));
      },

      // Sorting and filtering
      setSortBy: (sortBy) => set({ sortBy }),
      setSortOrder: (sortOrder) => set({ sortOrder }),
      setFilterTags: (filterTags) => set({ filterTags }),
      toggleShowFavoritesOnly: () => set((state) => ({ showFavoritesOnly: !state.showFavoritesOnly })),

      // Getters
      getProject: (id) => get().projects.find((p) => p.id === id),

      getRecentProjects: (limit = 5) => {
        const { projects, recentProjectIds } = get();
        return recentProjectIds
          .map((id) => projects.find((p) => p.id === id))
          .filter((p): p is DashboardProject => p !== undefined)
          .slice(0, limit);
      },

      getFavoriteProjects: () => get().projects.filter((p) => p.isFavorite),

      getSortedProjects: () => {
        const { projects, sortBy, sortOrder, filterTags, showFavoritesOnly } = get();
        
        let filtered = [...projects];
        
        // Filter by favorites
        if (showFavoritesOnly) {
          filtered = filtered.filter((p) => p.isFavorite);
        }
        
        // Filter by tags
        if (filterTags.length > 0) {
          filtered = filtered.filter((p) =>
            filterTags.some((tag) => p.tags.includes(tag))
          );
        }
        
        // Sort
        filtered.sort((a, b) => {
          let comparison = 0;
          switch (sortBy) {
            case 'name':
              comparison = a.name.localeCompare(b.name);
              break;
            case 'modifiedAt':
              comparison = a.modifiedAt - b.modifiedAt;
              break;
            case 'createdAt':
              comparison = a.createdAt - b.createdAt;
              break;
          }
          return sortOrder === 'asc' ? comparison : -comparison;
        });
        
        return filtered;
      },

      getAllTags: () => {
        const tags = new Set<string>();
        get().projects.forEach((p) => p.tags.forEach((t) => tags.add(t)));
        return Array.from(tags).sort();
      },

      getNextDefaultName: (baseName = 'Untitled Project') => {
        const projects = get().projects;
        const pattern = new RegExp(`^${baseName}(?:\\s(\\d+))?$`);
        let maxIndex = 0;

        projects.forEach((project) => {
          const match = project.name.match(pattern);
          if (!match) return;
          const index = match[1] ? Number(match[1]) : 1;
          if (!Number.isNaN(index)) {
            maxIndex = Math.max(maxIndex, index);
          }
        });

        return `${baseName} ${maxIndex + 1}`;
      },
    }),
    {
      name: STORAGE_KEYS.projects,
      version: 1,
    }
  )
);
