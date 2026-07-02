import type { CanvasItem, CanvasViewport } from '@/types';

export function viewportToCenterItem(
  item: Pick<CanvasItem, 'x' | 'y' | 'width' | 'height' | 'scale'>,
  viewport: CanvasViewport,
  canvasWidth: number,
  canvasHeight: number,
): Pick<CanvasViewport, 'x' | 'y'> {
  const w = item.width * item.scale;
  const h = item.height * item.scale;
  const cx = item.x + w / 2;
  const cy = item.y + h / 2;
  return {
    x: canvasWidth / 2 - cx * viewport.zoom,
    y: canvasHeight / 2 - cy * viewport.zoom,
  };
}

export function screenToCanvasPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  viewport: CanvasViewport,
): { x: number; y: number } {
  return {
    x: (clientX - rect.left - viewport.x) / viewport.zoom,
    y: (clientY - rect.top - viewport.y) / viewport.zoom,
  };
}

/** Minimum pointer movement (screen px) before a drag begins */
export const DRAG_THRESHOLD_PX = 4;

export function exceedsDragThreshold(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  threshold = DRAG_THRESHOLD_PX,
): boolean {
  return Math.hypot(currentX - startX, currentY - startY) >= threshold;
}
