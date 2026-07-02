import { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import type { CanvasItem } from '@/types';
import { exceedsDragThreshold, screenToCanvasPoint } from '@/lib/canvas/viewport';

const ANCHOR_BREAK_THRESHOLD_PX = 20; // pixels before connection snaps

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export type PointerDragKind =
  | 'item'
  | 'etiquette'
  | 'resize'
  | 'pan'
  | 'marquee'
  | 'anchor'
  | null;

export interface UseCanvasPointerOptions {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  activeTool: 'pointer' | 'lasso' | 'hand';
  viewport: { x: number; y: number; zoom: number };
  overlayTool?: 'pen' | 'shape' | 'text' | null;
  onOverlayStart?: (e: React.PointerEvent) => boolean;
  onPointerUp?: () => void;
}

export function useCanvasPointerInteractions(options: UseCanvasPointerOptions) {
  const {
    canvasRef,
    activeTool,
    viewport,
    overlayTool,
    onOverlayStart,
    onPointerUp,
  } = options;

  const {
    selectItem,
    clearSelection,
    snapshot,
    bringToFront,
    moveItemWithChildren,
    updateItem,
    updateEtiquettePosition,
    setViewport,
    startConnection,
    completeConnection,
    removeConnection,
    connections,
    items,
  } = useCanvasStore();

  const [dragKind, setDragKind] = useState<PointerDragKind>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [lassoPhase, setLassoPhase] = useState<'idle' | 'drawing'>('idle');
  const [marqueeStart, setMarqueeStart] = useState({ x: 0, y: 0 });
  const [marqueeEnd, setMarqueeEnd] = useState({ x: 0, y: 0 });
  const [resizingItemId, setResizingItemId] = useState<string | null>(null);
  const [resizingHandle, setResizingHandle] = useState<ResizeHandle | null>(null);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef<{ mouseX: number; mouseY: number; viewportX: number; viewportY: number } | null>(null);
  const resizeOriginRef = useRef<{ mouseX: number; mouseY: number; item: CanvasItem } | null>(null);
  const etiquetteOriginRef = useRef<{ itemId: string; offsetX: number; offsetY: number } | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const lassoJustFinishedRef = useRef(false);
  const anchorStartRef = useRef<{ clientX: number; clientY: number } | null>(null);

  const [connectionPreviewEnd, setConnectionPreviewEnd] = useState<{ x: number; y: number } | null>(null);
  const [hoverAnchorId, setHoverAnchorId] = useState<string | null>(null);
  const [shakingAnchorId, setShakingAnchorId] = useState<string | null>(null);
  const breakableConnectionRef = useRef<string | null>(null); // connection id to break on threshold

  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return null;
      return {
        x: (clientX - rect.left - viewport.x) / viewport.zoom,
        y: (clientY - rect.top - viewport.y) / viewport.zoom,
      };
    },
    [canvasRef, viewport],
  );

  const beginPan = useCallback((e: React.PointerEvent) => {
    setIsPanning(true);
    setDragKind('pan');
    activePointerIdRef.current = e.pointerId;
    panOriginRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      viewportX: viewport.x,
      viewportY: viewport.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [viewport]);

  const beginMarquee = useCallback((e: React.PointerEvent) => {
    setLassoPhase('drawing');
    setDragKind('marquee');
    activePointerIdRef.current = e.pointerId;
    setMarqueeStart({ x: e.clientX, y: e.clientY });
    setMarqueeEnd({ x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const handleItemPointerDown = useCallback(
    (e: React.PointerEvent, item: CanvasItem) => {
      e.stopPropagation();
      if (overlayTool) return;
      if (item.locked) return;
      if (activeTool === 'hand') {
        beginPan(e);
        return;
      }
      if (activeTool === 'lasso') {
        beginMarquee(e);
        return;
      }

      snapshot();
      selectItem(item.id, e.shiftKey || e.metaKey || e.ctrlKey);
      bringToFront(item.id);
      setDragItemId(item.id);
      setDragKind('item');
      activePointerIdRef.current = e.pointerId;
      dragStartRef.current = {
        x: e.clientX - item.x * viewport.zoom,
        y: e.clientY - item.y * viewport.zoom,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [overlayTool, activeTool, beginPan, beginMarquee, snapshot, selectItem, bringToFront, viewport.zoom],
  );

  const handleEtiquettePointerDown = useCallback(
    (e: React.PointerEvent, item: CanvasItem) => {
      e.stopPropagation();
      if (item.locked) return;
      snapshot();
      selectItem(item.id, e.shiftKey || e.metaKey || e.ctrlKey);
      setDragKind('etiquette');
      activePointerIdRef.current = e.pointerId;
      const etPos = item.etiquettePosition ?? { x: 0, y: -28 };
      etiquetteOriginRef.current = {
        itemId: item.id,
        offsetX: etPos.x,
        offsetY: etPos.y,
      };
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [snapshot, selectItem],
  );

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, item: CanvasItem, handle: ResizeHandle) => {
      e.stopPropagation();
      e.preventDefault();
      if (item.locked) return;
      snapshot();
      setResizingHandle(handle);
      setResizingItemId(item.id);
      setDragKind('resize');
      activePointerIdRef.current = e.pointerId;
      resizeOriginRef.current = { mouseX: e.clientX, mouseY: e.clientY, item: { ...item } };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [snapshot],
  );

  const handleAnchorPointerDown = useCallback(
    (e: React.PointerEvent, itemId: string, anchorId: string, kind: Parameters<typeof startConnection>[2]) => {
      e.stopPropagation();
      e.preventDefault();
      // Check if this anchor already has a connection — dragging from it will break that connection
      const currentConnections = useCanvasStore.getState().connections;
      const existingConn = currentConnections.find(
        (c) => c.sourceAnchorId === anchorId || c.targetAnchorId === anchorId
      );
      breakableConnectionRef.current = existingConn?.id ?? null;
      startConnection(itemId, anchorId, kind);
      setDragKind('anchor');
      activePointerIdRef.current = e.pointerId;
      anchorStartRef.current = { clientX: e.clientX, clientY: e.clientY };
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setConnectionPreviewEnd(screenToCanvasPoint(e.clientX, e.clientY, rect, viewport));
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [startConnection, canvasRef, viewport],
  );

  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        beginPan(e);
        return;
      }
      if (e.button !== 0) return;

      if (overlayTool && onOverlayStart?.(e)) return;

      const target = e.target as HTMLElement;
      const isBackground =
        target === canvasRef.current ||
        target.id === 'canvas-viewport-transform-layer' ||
        target.dataset.canvasBackground === 'true';

      if (!isBackground && !target.closest('[data-canvas-item-id]')) {
        // Allow clicks on empty SVG areas
        if (!target.closest('svg')) return;
      }

      if (activeTool === 'hand') beginPan(e);
      else if (activeTool === 'lasso') beginMarquee(e);
      else if (activeTool === 'pointer') beginMarquee(e);
    },
    [overlayTool, onOverlayStart, canvasRef, activeTool, beginPan, beginMarquee],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (activePointerIdRef.current != null && e.pointerId !== activePointerIdRef.current) return;

      if (dragKind === 'item' && dragItemId) {
        const newX = (e.clientX - dragStartRef.current.x) / viewport.zoom;
        const newY = (e.clientY - dragStartRef.current.y) / viewport.zoom;
        moveItemWithChildren(dragItemId, newX, newY);
      } else if (dragKind === 'etiquette' && etiquetteOriginRef.current) {
        const dx = (e.clientX - dragStartRef.current.x) / viewport.zoom;
        const dy = (e.clientY - dragStartRef.current.y) / viewport.zoom;
        updateEtiquettePosition(etiquetteOriginRef.current.itemId, {
          x: etiquetteOriginRef.current.offsetX + dx,
          y: etiquetteOriginRef.current.offsetY + dy,
        });
      } else if (dragKind === 'resize' && resizingItemId && resizingHandle && resizeOriginRef.current) {
        const { mouseX, mouseY, item: orig } = resizeOriginRef.current;
        const dx = (e.clientX - mouseX) / viewport.zoom;
        const dy = (e.clientY - mouseY) / viewport.zoom;
        const origW = orig.width * orig.scale;
        const origH = orig.height * orig.scale;
        let newX = orig.x;
        let newY = orig.y;
        let newW = origW;
        let newH = origH;
        const handle = resizingHandle;
        if (handle.includes('e')) newW = Math.max(32, origW + dx);
        if (handle.includes('s')) newH = Math.max(32, origH + dy);
        if (handle.includes('w')) {
          newW = Math.max(32, origW - dx);
          newX = orig.x + origW - newW;
        }
        if (handle.includes('n')) {
          newH = Math.max(32, origH - dy);
          newY = orig.y + origH - newH;
        }
        updateItem(resizingItemId, { x: newX, y: newY, width: newW, height: newH, scale: 1 });
      } else if (dragKind === 'marquee' && lassoPhase === 'drawing') {
        setMarqueeEnd({ x: e.clientX, y: e.clientY });
      } else if (dragKind === 'pan' && isPanning && panOriginRef.current) {
        const panOrigin = panOriginRef.current;
        setViewport({
          x: panOrigin.viewportX + (e.clientX - panOrigin.mouseX),
          y: panOrigin.viewportY + (e.clientY - panOrigin.mouseY),
        });
      } else if (dragKind === 'anchor') {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          setConnectionPreviewEnd(screenToCanvasPoint(e.clientX, e.clientY, rect, viewport));
        }
        // Breakable connection: shake and remove when threshold exceeded
        if (breakableConnectionRef.current && anchorStartRef.current) {
          const dx = e.clientX - anchorStartRef.current.clientX;
          const dy = e.clientY - anchorStartRef.current.clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > ANCHOR_BREAK_THRESHOLD_PX) {
            const pendConn = useCanvasStore.getState().pendingConnection;
            if (pendConn?.anchorId) {
              setShakingAnchorId(pendConn.anchorId);
              setTimeout(() => setShakingAnchorId(null), 400);
            }
            removeConnection(breakableConnectionRef.current);
            breakableConnectionRef.current = null;
          }
        }
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const anchorEl = target?.closest('[data-canvas-anchor-id]') as HTMLElement | null;
        setHoverAnchorId(anchorEl?.dataset.canvasAnchorId ?? null);
      }
    },
    [
      dragKind, dragItemId, viewport, moveItemWithChildren, updateEtiquettePosition,
      resizingItemId, resizingHandle, updateItem, lassoPhase, isPanning, setViewport,
      canvasRef,
    ],
  );

  const finalizeMarquee = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = (Math.min(marqueeStart.x, marqueeEnd.x) - rect.left - viewport.x) / viewport.zoom;
    const sy = (Math.min(marqueeStart.y, marqueeEnd.y) - rect.top - viewport.y) / viewport.zoom;
    const ex = (Math.max(marqueeStart.x, marqueeEnd.x) - rect.left - viewport.x) / viewport.zoom;
    const ey = (Math.max(marqueeStart.y, marqueeEnd.y) - rect.top - viewport.y) / viewport.zoom;
    const mW = Math.abs(marqueeEnd.x - marqueeStart.x);
    const mH = Math.abs(marqueeEnd.y - marqueeStart.y);
    if (mW > 4 && mH > 4) {
      const newSelected = items.filter((item) => {
        const iw = item.width * item.scale;
        const ih = item.height * item.scale;
        return item.x + iw > sx && item.x < ex && item.y + ih > sy && item.y < ey;
      }).map((item) => item.id);
      useCanvasStore.setState({ selectedIds: newSelected });
      lassoJustFinishedRef.current = true;
      setTimeout(() => { lassoJustFinishedRef.current = false; }, 150);
    }
  }, [canvasRef, marqueeStart, marqueeEnd, viewport, items]);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (activePointerIdRef.current != null && e.pointerId !== activePointerIdRef.current) return;

      if (dragKind === 'marquee' && lassoPhase === 'drawing') {
        finalizeMarquee();
        setLassoPhase('idle');
      }

      if (dragKind === 'anchor') {
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const anchorEl = target?.closest('[data-canvas-anchor-id]') as HTMLElement | null;
        if (anchorEl) {
          const targetItemId = anchorEl.dataset.canvasItemId!;
          const targetAnchorId = anchorEl.dataset.canvasAnchorId!;
          completeConnection(targetItemId, targetAnchorId);
        } else {
          useCanvasStore.getState().cancelConnection();
        }
        setConnectionPreviewEnd(null);
        setHoverAnchorId(null);
        anchorStartRef.current = null;
      }

      setDragKind(null);
      setDragItemId(null);
      setIsPanning(false);
      setResizingItemId(null);
      setResizingHandle(null);
      panOriginRef.current = null;
      resizeOriginRef.current = null;
      etiquetteOriginRef.current = null;
      activePointerIdRef.current = null;
      breakableConnectionRef.current = null;
      onPointerUp?.();
    },
    [dragKind, lassoPhase, finalizeMarquee, completeConnection, onPointerUp],
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (lassoJustFinishedRef.current) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-canvas-item-id]')) return;
      if (activeTool === 'pointer') clearSelection();
    },
    [activeTool, clearSelection],
  );

  useEffect(() => {
    if (!dragKind) return;
    const onMove = (ev: PointerEvent) => {
      handlePointerMove(ev as unknown as React.PointerEvent);
    };
    const onUp = (ev: PointerEvent) => {
      handlePointerUp(ev as unknown as React.PointerEvent);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragKind, handlePointerMove, handlePointerUp]);

  return {
    dragKind,
    dragItemId,
    isPanning,
    lassoPhase,
    marqueeStart,
    marqueeEnd,
    connectionPreviewEnd,
    hoverAnchorId,
    shakingAnchorId,
    getCanvasPoint,
    handleCanvasPointerDown,
    handleCanvasClick,
    handleItemPointerDown,
    handleEtiquettePointerDown,
    handleResizePointerDown,
    handleAnchorPointerDown,
    handlePointerMove,
    handlePointerUp,
    lassoJustFinishedRef,
  };
}
