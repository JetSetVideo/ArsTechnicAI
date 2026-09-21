import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useCanvasStore } from '@/stores/canvasStore';
import { setCanvasRestoring } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { useProjectsStore } from '@/stores/projectsStore';
import { useUserStore } from '@/stores/userStore';
import { useFileStore } from '@/stores/fileStore';
import { STORAGE_KEYS, WORKSPACE_DATA_KEYS_TO_CLEAR } from '@/constants/workspace';
import { projectPathFromName } from '@/utils/project';
import { deserializeCanvasItem, serializeCanvasItem, serializeCanvasGraph } from '@/lib/canvas/serialization';
import type { GenerationMeta } from '@/types';

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

function restoreCanvasFromApiItems(
  rawItems: Array<Record<string, unknown>>,
  graph?: { groups?: unknown[]; connections?: unknown[]; anchors?: unknown[] },
) {
  const canvasStore = useCanvasStore.getState();
  const items = rawItems.map((item) => deserializeCanvasItem(item));
  canvasStore.loadCanvasGraph({
    items: items as import('@/types').CanvasItem[],
    groups: graph?.groups as import('@/types').CanvasGroup[] | undefined,
    connections: graph?.connections as import('@/types').CanvasConnection[] | undefined,
    anchors: graph?.anchors as import('@/types').CanvasAnchor[] | undefined,
  });
}

export function saveProjectWorkspaceState(projectId: string, projectName: string): void {
  if (!projectId || typeof window === 'undefined') return;
  try {
    const { items, viewport, groups, connections, anchors } = useCanvasStore.getState();
    // Guard: don't overwrite existing saved state with empty canvas
    if (items.length === 0) {
      const existing = localStorage.getItem(canvasStateKey(projectId));
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          if (Array.isArray(parsed.items) && parsed.items.length > 0) return;
        } catch { /* corrupt data, ok to overwrite */ }
      }
    }
    const payload = {
      items,
      viewport,
      ...serializeCanvasGraph(groups, connections, anchors),
      savedAt: Date.now(),
    };
    localStorage.setItem(canvasStateKey(projectId), JSON.stringify(payload));
  } catch {
    // localStorage quota or serialisation errors are non-fatal
  }

  try {
    useFileStore.getState().saveProjectFileState(projectId, projectName);
  } catch {
    // non-fatal
  }
}

export async function loadProjectWorkspaceState(projectId: string, _projectName: string): Promise<boolean> {
  if (!projectId || typeof window === 'undefined') return false;

  setCanvasRestoring(true);

  // Try localStorage first (fast path, same browser)
  try {
    const raw = localStorage.getItem(canvasStateKey(projectId));
    if (raw) {
      const { items, viewport, groups, connections, anchors } = JSON.parse(raw);
      const canvas = useCanvasStore.getState();
      if (viewport) canvas.setViewport(viewport);

      if (Array.isArray(items) && items.length > 0) {
        canvas.clearAll();
        canvas.loadCanvasGraph({ items, groups, connections, anchors });
        setCanvasRestoring(false);
        return true;
      }
    }
  } catch {
    // Corrupt data is non-fatal
  }

  // Fall back to disk files (.ars-data/canvas-{id}.json)
  try {
    const diskRes = await fetch(`/api/workspace/load?projectId=${encodeURIComponent(projectId)}`);
    if (diskRes.ok) {
      const diskData = await diskRes.json();
      const diskCanvas = diskData?.canvas;
      if (diskCanvas?.items?.length) {
        const canvasStore = useCanvasStore.getState();
        if (diskCanvas.viewport) canvasStore.setViewport(diskCanvas.viewport);
        canvasStore.clearAll();
        restoreCanvasFromApiItems(diskCanvas.items, {
          groups: diskCanvas.groups,
          connections: diskCanvas.connections,
          anchors: diskCanvas.anchors,
        });
        rebuildFileTreeFromItems(diskCanvas.items);
        saveProjectWorkspaceState(projectId, _projectName);
        setCanvasRestoring(false);
        return true;
      }
    }
  } catch {
    // Disk load failure is non-fatal
  }

  // Fall back to loading from DB (cross-browser / fresh session)
  try {
    const canvasRes = await fetch(`/api/projects/${projectId}/canvas`);
    if (!canvasRes.ok) { setCanvasRestoring(false); return false; }

    const { data: canvas } = await canvasRes.json();
    if (!canvas) { setCanvasRestoring(false); return false; }

    const canvasStore = useCanvasStore.getState();

    if (canvas.viewportX != null || canvas.viewportZoom != null) {
      canvasStore.setViewport({
        x: canvas.viewportX ?? 0,
        y: canvas.viewportY ?? 0,
        zoom: canvas.viewportZoom ?? 1,
      });
    }

    if (Array.isArray(canvas.items) && canvas.items.length > 0) {
      canvasStore.clearAll();
      restoreCanvasFromApiItems(canvas.items, {
        groups: canvas.groups,
        connections: canvas.connections,
        anchors: canvas.anchors,
      });
      rebuildFileTreeFromItems(canvas.items);
      saveProjectWorkspaceState(projectId, _projectName);
      setCanvasRestoring(false);
      return true;
    }
  } catch {
    // DB load failure is non-fatal
  }

  setCanvasRestoring(false);
  return false;
}

function rebuildFileTreeFromItems(items: Array<Record<string, unknown>>) {
  const fileStore = useFileStore.getState();
  const generatedPath = fileStore.getProjectGeneratedPath();
  for (const item of items) {
    const type = ((item.type as string) ?? '').toLowerCase();
    if (type === 'generated' && item.name) {
      const meta = (item.nodeData ?? item.generationMeta) as Record<string, unknown> | undefined;
      fileStore.addAssetToFolder(
        {
          id: (item.assetId as string) || (item.id as string) || Date.now().toString(),
          name: item.name as string,
          type: 'image',
          path: `${generatedPath}/${item.name}`,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          thumbnail: (item.dataUrl as string) || (item.src as string) || '',
          metadata: {
            width: item.width as number,
            height: item.height as number,
            prompt: (item.prompt ?? meta?.prompt) as string,
            model: meta?.model as string,
            seed: meta?.seed as number,
          },
        },
        generatedPath,
      );
    }
  }
}

export function clearAllWorkspaceData(): void {
  if (typeof window === 'undefined') return;
  for (const key of WORKSPACE_DATA_KEYS_TO_CLEAR) {
    localStorage.removeItem(key);
  }
  // Also clear per-project canvas snapshots, pipeline drafts, and file-state
  // blobs (all keyed as `<baseKey>:<projectId>`, not covered by the flat list
  // above).
  const perProjectPrefixes = [
    `${STORAGE_KEYS.canvasStates}:`,
    `${STORAGE_KEYS.fileStates}:`,
    'ars:pipeline-workshop:',
  ];
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && perProjectPrefixes.some((prefix) => k.startsWith(prefix))) toRemove.push(k);
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
  // Dirty-check for the 30s AUTO-save interval below: skip creating a DB
  // version + PUTting the canvas when nothing has changed since the last
  // sync (reference equality is enough — canvasStore only produces a new
  // `items`/`connections` array reference when they actually change).
  const lastAutoSyncedRef = useRef<{ items: unknown; connections: unknown } | null>(null);

  const syncCanvas = useCallback(async () => {
    if (!projectId || !session?.user) return;

    const { items, viewport, groups, connections, anchors } = useCanvasStore.getState();

    try {
      await fetch(`/api/projects/${projectId}/canvas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewportX: viewport.x,
          viewportY: viewport.y,
          viewportZoom: viewport.zoom,
          items: items.map((item) => serializeCanvasItem(item)),
          edges: connections.map((c) => ({
            sourceItemId: c.sourceItemId,
            targetItemId: c.targetItemId,
            sourcePort: c.sourceAnchorId,
            targetPort: c.targetAnchorId,
            dataType: c.kind,
            metadata: { color: c.color, id: c.id },
          })),
          ...serializeCanvasGraph(groups, connections, anchors),
        }),
      });

      useFileStore.getState().saveProjectFileState(projectId, useProjectStore.getState().projectName ?? '');
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

  useEffect(() => {
    if (!projectId || !session?.user) return;

    const id = setInterval(() => {
      const { items, connections } = useCanvasStore.getState();
      const prev = lastAutoSyncedRef.current;
      if (prev && prev.items === items && prev.connections === connections) return; // nothing changed
      lastAutoSyncedRef.current = { items, connections };
      saveVersion('AUTO', 'Autosave');
    }, AUTOSAVE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [projectId, session?.user, saveVersion]);

  const loadProjectFromDb = useCallback(async (id: string) => {
    try {
      const [projectRes, canvasRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/projects/${id}/canvas`),
      ]);

      if (!projectRes.ok) return null;
      const { data: project } = await projectRes.json();

      useProjectStore.getState().setProject(id, project.name ?? 'Untitled');

      if (canvasRes.ok) {
        const { data: canvas } = await canvasRes.json();
        if (canvas) {
          const canvasStore = useCanvasStore.getState();

          if (canvas.viewportX != null || canvas.viewportZoom != null) {
            canvasStore.setViewport({
              x: canvas.viewportX ?? 0,
              y: canvas.viewportY ?? 0,
              zoom: canvas.viewportZoom ?? 1,
            });
          }

          if (Array.isArray(canvas.items) && canvas.items.length > 0) {
            canvasStore.clearAll();
            restoreCanvasFromApiItems(canvas.items, {
              groups: canvas.groups,
              connections: canvas.connections,
              anchors: canvas.anchors,
            });
          }

          const fileStore = useFileStore.getState();
          fileStore.switchToProject(project.name ?? 'Untitled', id);
          const generatedPath = fileStore.getProjectGeneratedPath();
          if (Array.isArray(canvas.items)) {
            for (const item of canvas.items) {
              if (item.type?.toLowerCase() === 'generated' && item.name) {
                fileStore.addAssetToFolder(
                  {
                    id: item.assetId || item.id || Date.now().toString(),
                    name: item.name,
                    type: 'image',
                    path: `${generatedPath}/${item.name}`,
                    createdAt: Date.now(),
                    modifiedAt: Date.now(),
                    thumbnail: item.dataUrl || item.src || '',
                    metadata: {
                      width: item.width,
                      height: item.height,
                      prompt: item.prompt,
                      model: item.nodeData?.model,
                      seed: item.nodeData?.seed,
                    },
                  },
                  generatedPath,
                );
              }
            }
          }
        }
      }

      saveProjectWorkspaceState(id, project.name ?? 'Untitled');

      return project as Record<string, unknown>;
    } catch {
      return null;
    }
  }, []);

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
