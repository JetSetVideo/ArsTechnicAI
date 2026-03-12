import { useCallback, useRef, useEffect } from 'react';
import { useCanvasStore } from '@/stores';

export function useCanvasPersistence(projectId: string | null) {
  const { items, viewport } = useCanvasStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  const save = useCallback(async () => {
    if (!projectId) return;

    const stateHash = JSON.stringify({ items: items.length, viewport });
    if (stateHash === lastSavedRef.current) return;

    try {
      await fetch(`/api/projects/${projectId}/canvas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            type: item.type?.toUpperCase() || 'IMAGE',
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            rotation: item.rotation,
            scale: item.scale,
            zIndex: item.zIndex,
            locked: item.locked,
            visible: item.visible,
            name: item.name,
            prompt: item.prompt,
            dataUrl: item.src,
          })),
          viewportX: viewport.x,
          viewportY: viewport.y,
          viewportZoom: viewport.zoom,
        }),
      });
      lastSavedRef.current = stateHash;
    } catch (error) {
      console.error('Canvas save failed:', error);
    }
  }, [projectId, items, viewport]);

  // Debounced auto-save (2s)
  useEffect(() => {
    if (!projectId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, 2000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [projectId, items, viewport, save]);

  return { save };
}
