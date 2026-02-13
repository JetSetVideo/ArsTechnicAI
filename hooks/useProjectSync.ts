/**
 * useProjectSync
 * 
 * Bridges the editor's userStore (currentProject) with the dashboard's projectsStore.
 * Ensures every project the user opens/creates in the editor also exists in the
 * dashboard project list, and vice versa.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useFileStore } from '@/stores/fileStore';
import { useProjectsStore } from '@/stores/projectsStore';
import { useUserStore } from '@/stores/userStore';
import { projectPathFromName } from '@/utils/project';
import { STORAGE_KEYS, WORKSPACE_DATA_KEYS_TO_CLEAR, WORKSPACE_DEFAULTS } from '@/constants/workspace';

/**
 * Syncs editor projects into projectsStore on mount and when currentProject changes.
 * Call this in AppShell (editor) and DashboardLayout (dashboard).
 */
export function useProjectSync() {
  const currentProject = useUserStore((s) => s.currentProject);
  const recentProjects = useUserStore((s) => s.recentProjects);
  const switchProjectUser = useUserStore((s) => s.switchProject);
  const switchToProjectFiles = useFileStore((s) => s.switchToProject);

  const {
    getProject,
    updateProject,
    openProject,
  } = useProjectsStore();

  const canvasItems = useCanvasStore((s) => s.items);
  const syncedRef = useRef(false);

  const ensureProjectInDashboard = useCallback((id: string, name: string, modifiedAt?: number, createdAt?: number) => {
    if (!id) return;
    const existing = useProjectsStore.getState().getProject(id);
    if (!existing) {
      // Keep the same project ID as userStore to avoid broken cross-store links.
      useProjectsStore.setState((state) => ({
        projects: [
          {
            id,
            name,
            createdAt: createdAt || Date.now(),
            modifiedAt: modifiedAt || Date.now(),
            assetCount: 0,
            tags: [],
            isFavorite: false,
          },
          ...state.projects.filter((p) => p.id !== id),
        ],
      }));
      return;
    }

    if (existing.name !== name) {
      useProjectsStore.getState().updateProject(id, { name });
    }
  }, []);

  // Also sync recent projects on mount
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;

    // Sync current project
    ensureProjectInDashboard(
      currentProject.id,
      currentProject.name,
      currentProject.modifiedAt,
      currentProject.createdAt
    );

    // Sync recent projects
    recentProjects.forEach((proj) => {
      ensureProjectInDashboard(proj.id, proj.name, proj.modifiedAt, proj.createdAt);
    });
  }, [currentProject, ensureProjectInDashboard, recentProjects]);

  /**
   * Open a project from the dashboard → load into editor.
   * Sets userStore.currentProject and loads canvas/file state.
   */
  const openProjectFromDashboard = useCallback(
    (projectId: string) => {
      const dashProject = useProjectsStore.getState().getProject(projectId);
      if (!dashProject) return;

      // Save current project's canvas state before switching
      saveCanvasState(currentProject.id);

      // Mark as opened in projectsStore
      openProject(projectId);

      // Check if the project exists in userStore's recent list
      const inRecent = recentProjects.find((p) => p.id === projectId);
      if (inRecent) {
        switchProjectUser(projectId);
      } else {
        // Set directly via userStore state for new dashboard-only projects
        useUserStore.setState((state) => ({
          currentProject: {
            id: dashProject.id,
            name: dashProject.name,
            createdAt: dashProject.createdAt,
            modifiedAt: dashProject.modifiedAt,
            path: projectPathFromName(dashProject.name),
          },
          recentProjects: [
            state.currentProject,
            ...state.recentProjects.filter((p) => p.id !== dashProject.id),
          ].slice(0, 10),
        }));
      }

      // Always switch file tree to the selected project context.
      switchToProjectFiles(dashProject.name);
    },
    [currentProject.id, recentProjects, switchProjectUser, openProject, switchToProjectFiles]
  );

  /**
   * Create a new project from the dashboard that will also exist in userStore.
   */
  const createProjectFromDashboard = useCallback(
    (name: string, tags: string[]) => {
      // Create in projectsStore first
      const dashProject = useProjectsStore.getState().addProject({ name, tags });

      // Save current canvas state
      saveCanvasState(currentProject.id);

      // Create matching entry in userStore
      // We use the dashboard project's ID to keep them in sync
      useUserStore.setState((state) => ({
        currentProject: {
          id: dashProject.id,
          name: dashProject.name,
          createdAt: dashProject.createdAt,
          modifiedAt: dashProject.modifiedAt,
          path: projectPathFromName(dashProject.name),
        },
        recentProjects: [
          state.currentProject,
          ...state.recentProjects.filter((p) => p.id !== dashProject.id),
        ].slice(0, 10),
      }));

      return dashProject;
    },
    [currentProject.id]
  );

  /**
   * Update the asset count for the current project in the dashboard.
   */
  const syncAssetCount = useCallback(() => {
    if (!currentProject?.id) return;
    const count = canvasItems.length;
    const existing = useProjectsStore.getState().getProject(currentProject.id);
    if (existing && existing.assetCount !== count) {
      updateProject(currentProject.id, { assetCount: count });
    }
  }, [currentProject?.id, canvasItems.length, updateProject]);

  // Keep asset count in sync
  useEffect(() => {
    syncAssetCount();
  }, [syncAssetCount]);

  return {
    openProjectFromDashboard,
    createProjectFromDashboard,
    ensureProjectInDashboard,
    syncAssetCount,
  };
}

// ═══════════════════════════════════════════════════════════
// CANVAS STATE PERSISTENCE PER PROJECT
// ═══════════════════════════════════════════════════════════

const CANVAS_STATES_KEY = STORAGE_KEYS.canvasStates;

interface SavedCanvasState {
  items: any[];
  viewport: { x: number; y: number; zoom: number };
  savedAt: number;
}

export function clearAllWorkspaceData() {
  if (typeof window === 'undefined') return;

  WORKSPACE_DATA_KEYS_TO_CLEAR.forEach((key) => localStorage.removeItem(key));
  localStorage.setItem(STORAGE_KEYS.workspaceWipeFlag, 'true');

  useCanvasStore.setState({
    items: [],
    selectedIds: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    clipboard: [],
  });

  useFileStore.setState({
    rootNodes: [],
    assets: new Map(),
    selectedPath: null,
    expandedPaths: new Set(),
    currentProjectPath: projectPathFromName(WORKSPACE_DEFAULTS.projectName),
  });

  useProjectsStore.setState({
    projects: [],
    currentProjectId: null,
    recentProjectIds: [],
    sortBy: 'modifiedAt',
    sortOrder: 'desc',
    filterTags: [],
    showFavoritesOnly: false,
  });

  const defaultProjectPath = projectPathFromName(WORKSPACE_DEFAULTS.projectName);
  useUserStore.setState((state) => ({
    currentProject: {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: WORKSPACE_DEFAULTS.projectName,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      path: defaultProjectPath,
    },
    recentProjects: [],
  }));
}

/**
 * Save current canvas state for a specific project.
 */
export function saveCanvasState(projectId: string) {
  if (!projectId) return;

  const { items, viewport } = useCanvasStore.getState();
  const states = loadCanvasStates();
  states[projectId] = { items, viewport, savedAt: Date.now() };

  try {
    localStorage.setItem(CANVAS_STATES_KEY, JSON.stringify(states));
  } catch (e) {
    console.warn('[ProjectSync] Failed to save canvas state:', e);
  }
}

/**
 * Load canvas state for a specific project.
 */
export function loadCanvasState(projectId: string): boolean {
  if (!projectId) return false;

  const states = loadCanvasStates();
  const saved = states[projectId];
  if (!saved) return false;

  useCanvasStore.setState({
    items: saved.items || [],
    viewport: saved.viewport || { x: 0, y: 0, zoom: 1 },
    selectedIds: [],
    clipboard: [],
  });

  return true;
}

function loadCanvasStates(): Record<string, SavedCanvasState> {
  try {
    const raw = localStorage.getItem(CANVAS_STATES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
