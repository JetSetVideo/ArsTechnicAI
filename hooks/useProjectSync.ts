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
import { useProductionStore } from '@/stores/productionStore';
import { useUserStore } from '@/stores/userStore';
import { projectPathFromName } from '@/utils/project';
import { STORAGE_KEYS, WORKSPACE_DATA_KEYS_TO_CLEAR, WORKSPACE_DEFAULTS } from '@/constants/workspace';

const CLOUD_SYNC_META_KEY = 'ars-technicai-cloud-sync-meta';

interface CloudSyncMeta {
  lastWorkspaceSyncAt?: number;
  lastAssetSyncAt?: number;
  lastSyncedProjectId?: string;
  lastSyncError?: string;
}

function loadCloudSyncMeta(): CloudSyncMeta {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CLOUD_SYNC_META_KEY);
    return raw ? (JSON.parse(raw) as CloudSyncMeta) : {};
  } catch {
    return {};
  }
}

function saveCloudSyncMeta(update: Partial<CloudSyncMeta>) {
  if (typeof window === 'undefined') return;
  const current = loadCloudSyncMeta();
  localStorage.setItem(CLOUD_SYNC_META_KEY, JSON.stringify({ ...current, ...update }));
}

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
    useProductionStore
      .getState()
      .ensureProjectRecord({ projectId: currentProject.id, projectName: currentProject.name });

    // Sync recent projects
    recentProjects.forEach((proj) => {
      ensureProjectInDashboard(proj.id, proj.name, proj.modifiedAt, proj.createdAt);
      useProductionStore
        .getState()
        .ensureProjectRecord({ projectId: proj.id, projectName: proj.name });
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

      // Save current project's workspace state before switching
      void saveProjectWorkspaceState(currentProject.id, currentProject.name);

      // Mark as opened in projectsStore
      openProject(projectId);
      useProductionStore
        .getState()
        .ensureProjectRecord({ projectId: dashProject.id, projectName: dashProject.name });

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

      // Switch and restore workspace state for the selected project.
      switchToProjectFiles(dashProject.name, dashProject.id);
      void loadProjectWorkspaceState(dashProject.id, dashProject.name);
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

      // Save current workspace state before switching
      void saveProjectWorkspaceState(currentProject.id, currentProject.name);

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

      useProductionStore
        .getState()
        .ensureProjectRecord({ projectId: dashProject.id, projectName: dashProject.name });

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

interface CloudProjectAssetPayload {
  assetId: string;
  name: string;
  path: string;
  mimeType?: string;
  width?: number;
  height?: number;
  payloadDataUrl?: string;
  metadata?: Record<string, unknown>;
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function syncWorkspaceStateToCloud(projectId: string, payload: SavedWorkspaceState) {
  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch(`/api/projects/${projectId}/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ state: payload }),
    });
    if (response.ok) {
      saveCloudSyncMeta({
        lastWorkspaceSyncAt: Date.now(),
        lastSyncedProjectId: projectId,
        lastSyncError: undefined,
      });
    } else {
      saveCloudSyncMeta({
        lastSyncError: `Workspace sync failed (${response.status})`,
      });
    }
  } catch {
    // Local-first by design: cloud sync is best effort.
    saveCloudSyncMeta({
      lastSyncError: 'Workspace sync failed (network error)',
    });
  }
}

function collectCloudAssets(filesSnapshot: SavedWorkspaceState['files']): CloudProjectAssetPayload[] {
  return (filesSnapshot.projectAssets || [])
    .map(([, asset]) => {
      const dataUrlCandidate =
        (typeof (asset as any)?.dataUrl === 'string' && (asset as any).dataUrl) ||
        (typeof asset.thumbnail === 'string' && asset.thumbnail.startsWith('data:') ? asset.thumbnail : undefined);
      return {
        assetId: asset.id,
        name: asset.name,
        path: asset.path,
        mimeType: asset.metadata?.mimeType,
        width: asset.metadata?.width,
        height: asset.metadata?.height,
        payloadDataUrl: dataUrlCandidate,
        metadata: asset.metadata || undefined,
      };
    })
    .filter((asset) => Boolean(asset.assetId));
}

function stripBinaryFromFileSnapshot(filesSnapshot: SavedWorkspaceState['files']): SavedWorkspaceState['files'] {
  return {
    ...filesSnapshot,
    projectAssets: (filesSnapshot.projectAssets || []).map(([assetId, asset]) => [
      assetId,
      {
        ...asset,
        thumbnail: typeof asset.thumbnail === 'string' && asset.thumbnail.startsWith('data:')
          ? undefined
          : asset.thumbnail,
      },
    ]),
  };
}

async function syncProjectAssetsToCloud(projectId: string, assets: CloudProjectAssetPayload[]) {
  const token = getAuthToken();
  if (!token || assets.length === 0) return;

  try {
    const response = await fetch(`/api/projects/${projectId}/assets`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ assets }),
    });
    if (response.ok) {
      saveCloudSyncMeta({
        lastAssetSyncAt: Date.now(),
        lastSyncedProjectId: projectId,
        lastSyncError: undefined,
      });
    } else {
      saveCloudSyncMeta({
        lastSyncError: `Asset sync failed (${response.status})`,
      });
    }
  } catch {
    // Local-first fallback.
    saveCloudSyncMeta({
      lastSyncError: 'Asset sync failed (network error)',
    });
  }
}

async function loadProjectAssetsFromCloud(projectId: string): Promise<CloudProjectAssetPayload[]> {
  const token = getAuthToken();
  if (!token) return [];

  try {
    const response = await fetch(`/api/projects/${projectId}/assets`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { assets?: Array<any> };
    return (body.assets || []).map((row) => ({
      assetId: row.assetId,
      name: row.name,
      path: row.path,
      mimeType: row.mimeType || undefined,
      width: row.width ?? undefined,
      height: row.height ?? undefined,
      payloadDataUrl: row.payloadDataUrl || undefined,
      metadata: (row.metadata || undefined) as Record<string, unknown> | undefined,
    }));
  } catch {
    return [];
  }
}

async function loadWorkspaceStateFromCloud(projectId: string): Promise<SavedWorkspaceState | null> {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const response = await fetch(`/api/projects/${projectId}/state`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { state?: SavedWorkspaceState };
    return body?.state || null;
  } catch {
    return null;
  }
}

export async function saveProjectWorkspaceState(projectId: string, projectName: string) {
  if (!projectId || typeof window === 'undefined') return;

  saveCanvasState(projectId);
  useFileStore.getState().saveProjectFileState(projectId, projectName);

  const canvasStates = loadCanvasStates();
  const savedCanvas = canvasStates[projectId];
  if (!savedCanvas) return;

  const filesSnapshot = useFileStore.getState().exportProjectFileState(projectName);
  const payload: SavedWorkspaceState = {
    version: 1,
    savedAt: Date.now(),
    canvas: savedCanvas,
    files: stripBinaryFromFileSnapshot(filesSnapshot),
  };
  await syncProjectAssetsToCloud(projectId, collectCloudAssets(filesSnapshot));
  await syncWorkspaceStateToCloud(projectId, payload);
}

export async function loadProjectWorkspaceState(projectId: string, projectName: string): Promise<boolean> {
  if (!projectId || typeof window === 'undefined') return false;

  const localCanvasLoaded = loadCanvasState(projectId);
  const localFilesLoaded = useFileStore.getState().loadProjectFileState(projectId, projectName);
  if (localCanvasLoaded || localFilesLoaded) {
    return true;
  }

  const cloudState = await loadWorkspaceStateFromCloud(projectId);
  if (!cloudState) return false;

  const cloudAssets = await loadProjectAssetsFromCloud(projectId);
  const cloudAssetMap = new Map(cloudAssets.map((asset) => [asset.assetId, asset]));
  const patchedFiles = {
    ...cloudState.files,
    projectAssets: (cloudState.files.projectAssets || []).map(([assetId, asset]) => {
      const cloud = cloudAssetMap.get(asset.id || assetId);
      return [
        assetId,
        {
          ...asset,
          thumbnail: cloud?.payloadDataUrl || asset.thumbnail,
          metadata: {
            ...(asset.metadata || {}),
            ...(cloud?.metadata || {}),
            mimeType: cloud?.mimeType || asset.metadata?.mimeType,
            width: cloud?.width ?? asset.metadata?.width,
            height: cloud?.height ?? asset.metadata?.height,
          },
        },
      ] as [string, typeof asset];
    }),
  };

  useCanvasStore.setState({
    items: cloudState.canvas?.items || [],
    viewport: cloudState.canvas?.viewport || { x: 0, y: 0, zoom: 1 },
    selectedIds: [],
    clipboard: [],
  });
  useFileStore.getState().applyProjectFileState(projectName, patchedFiles);

  const canvasStates = loadCanvasStates();
  canvasStates[projectId] = {
    items: cloudState.canvas?.items || [],
    viewport: cloudState.canvas?.viewport || { x: 0, y: 0, zoom: 1 },
    savedAt: Date.now(),
  };
  localStorage.setItem(CANVAS_STATES_KEY, JSON.stringify(canvasStates));
  useFileStore.getState().saveProjectFileState(projectId, projectName);

  return true;
}

interface SavedWorkspaceState {
  version: 1;
  savedAt: number;
  canvas: SavedCanvasState;
  files: ReturnType<typeof useFileStore.getState.exportProjectFileState>;
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

  useProductionStore.setState({
    records: {},
    currentProjectId: null,
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
