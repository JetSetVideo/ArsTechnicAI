import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { useProjectsStore } from '@/stores/projectsStore';
import { useUserStore } from '@/stores/userStore';
import { useFileStore } from '@/stores/fileStore';
import { STORAGE_KEYS, WORKSPACE_DATA_KEYS_TO_CLEAR } from '@/constants/workspace';
import { projectPathFromName } from '@/utils/project';

type VersionTrigger = 'MANUAL' | 'GENERATE' | 'DELETE' | 'AUTO';

interface ProjectSyncState {
  saveVersion: (trigger: VersionTrigger, label?: string) => Promise<void>;
  syncCanvas: () => Promise<void>;
  loadProjectFromDb: (id: string) => Promise<Record<string, unknown> | null>;
  openProjectFromDashboard: (projectId: string) => void;
  isSaving: boolean;
  lastSaved: Date | null;
}

const AUTOSAVE_INTERVAL_MS = 30_000;

// ============================================
// Standalone helpers (usable outside React)
// ============================================

function canvasStateKey(projectId: string): string {
  return `${STORAGE_KEYS.canvasStates}:${projectId}`;
}

export function saveProjectWorkspaceState(projectId: string, _projectName: string): void {
  if (!projectId || typeof window === 'undefined') return;
  try {
    const { items, viewport } = useCanvasStore.getState();
    const payload = { items, viewport, savedAt: Date.now() };
    localStorage.setItem(canvasStateKey(projectId), JSON.stringify(payload));
  } catch {
    // localStorage quota or serialisation errors are non-fatal
  }
}

export function loadProjectWorkspaceState(projectId: string, _projectName: string): void {
  if (!projectId || typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(canvasStateKey(projectId));
    if (!raw) return;
    const { items, viewport } = JSON.parse(raw);
    const canvas = useCanvasStore.getState();
    if (viewport) canvas.setViewport(viewport);
    if (Array.isArray(items) && items.length > 0) {
      canvas.clearCanvas();
      for (const item of items) canvas.addItem(item);
    }
  } catch {
    // Corrupt data is non-fatal — start with a blank canvas
  }
}

export function clearAllWorkspaceData(): void {
  if (typeof window === 'undefined') return;
  for (const key of WORKSPACE_DATA_KEYS_TO_CLEAR) {
    localStorage.removeItem(key);
  }
  // Also clear per-project canvas snapshots
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(`${STORAGE_KEYS.canvasStates}:`)) toRemove.push(k);
  }
  for (const k of toRemove) localStorage.removeItem(k);
}

// ============================================
// React hook
// ============================================

export function useProjectSync(projectId?: string | null): ProjectSyncState {
  const { data: session } = useSession();
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const savingRef = useRef(false);

  const { markSynced, markDirty } = useProjectStore();

  // Sync the in-memory canvas to the DB canvas endpoint
  const syncCanvas = useCallback(async () => {
    if (!projectId || !session?.user) return;

    const { items, viewport } = useCanvasStore.getState();

    try {
      await fetch(`/api/projects/${projectId}/canvas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewportX: viewport.x,
          viewportY: viewport.y,
          viewportZoom: viewport.zoom,
          items: items.map((item) => ({
            type: item.type.toUpperCase(),
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            rotation: item.rotation,
            scaleX: item.scale,
            scaleY: item.scale,
            zIndex: item.zIndex,
            visible: item.visible,
            locked: item.locked,
            name: item.name,
            src: item.src,
            prompt: item.prompt,
            assetId: item.assetId ?? null,
          })),
          edges: [],
        }),
      });
    } catch {
      // Canvas sync failures are non-fatal
    }
  }, [projectId, session?.user]);

  const saveVersion = useCallback(
    async (trigger: VersionTrigger, label?: string) => {
      if (!projectId || !session?.user || savingRef.current) return;

      savingRef.current = true;
      setIsSaving(true);

      try {
        // Sync canvas to DB first so the snapshot captures current state
        await syncCanvas();

        const res = await fetch(`/api/projects/${projectId}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger, label }),
        });

        if (res.ok) {
          setLastSaved(new Date());
          markSynced();
        }
      } catch {
        // Version save failures are non-fatal
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [projectId, session?.user, syncCanvas, markSynced]
  );

  // Autosave every 30s when authenticated and project is open
  useEffect(() => {
    if (!projectId || !session?.user) return;

    const id = setInterval(() => {
      saveVersion('AUTO', 'Autosave');
    }, AUTOSAVE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [projectId, session?.user, saveVersion]);

  // Load project metadata + canvas from DB and populate stores
  const loadProjectFromDb = useCallback(async (id: string) => {
    try {
      const [projectRes, canvasRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/projects/${id}/canvas`),
      ]);

      if (!projectRes.ok) return null;
      const { data: project } = await projectRes.json();

      // Populate projectStore
      useProjectStore.getState().setProject(id, project.name ?? 'Untitled');

      // Populate canvasStore if canvas data exists
      if (canvasRes.ok) {
        const { data: canvas } = await canvasRes.json();
        if (canvas) {
          const canvasStore = useCanvasStore.getState();

          // Restore viewport
          if (canvas.viewportX != null || canvas.viewportZoom != null) {
            canvasStore.setViewport({
              x: canvas.viewportX ?? 0,
              y: canvas.viewportY ?? 0,
              zoom: canvas.viewportZoom ?? 1,
            });
          }

          // Restore items (only if canvas has persisted items)
          if (Array.isArray(canvas.items) && canvas.items.length > 0) {
            canvasStore.clearCanvas();
            for (const item of canvas.items) {
              canvasStore.addItem({
                type: (item.type?.toLowerCase?.() ?? 'image') as 'image' | 'generated' | 'placeholder',
                x: item.x ?? 0,
                y: item.y ?? 0,
                width: item.width ?? 512,
                height: item.height ?? 512,
                rotation: item.rotation ?? 0,
                scale: item.scaleX ?? 1,
                locked: item.locked ?? false,
                visible: item.visible ?? true,
                src: item.src ?? '',
                name: item.name ?? 'Untitled',
                prompt: item.prompt ?? undefined,
                assetId: item.assetId ?? undefined,
              });
            }
          }

          markDirty();
        }
      }

      return project as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [markDirty]);

  const openProjectFromDashboard = useCallback((targetId: string) => {
    const dashProject = useProjectsStore.getState().getProject(targetId);
    if (!dashProject) return;

    useUserStore.setState({
      currentProject: {
        id: dashProject.id,
        name: dashProject.name,
        createdAt: dashProject.createdAt,
        modifiedAt: dashProject.modifiedAt,
        path: projectPathFromName(dashProject.name),
      },
    });

    useFileStore.getState().switchToProject(dashProject.name, dashProject.id);
    loadProjectWorkspaceState(targetId, dashProject.name);
  }, []);

  return { saveVersion, syncCanvas, loadProjectFromDb, openProjectFromDashboard, isSaving, lastSaved };
}
