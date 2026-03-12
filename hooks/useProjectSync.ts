import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';

type VersionTrigger = 'MANUAL' | 'GENERATE' | 'DELETE' | 'AUTO';

interface ProjectSyncState {
  saveVersion: (trigger: VersionTrigger, label?: string) => Promise<void>;
  syncCanvas: () => Promise<void>;
  loadProjectFromDb: (id: string) => Promise<Record<string, unknown> | null>;
  isSaving: boolean;
  lastSaved: Date | null;
}

const AUTOSAVE_INTERVAL_MS = 30_000;

export function useProjectSync(projectId: string | null): ProjectSyncState {
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

  return { saveVersion, syncCanvas, loadProjectFromDb, isSaving, lastSaved };
}
