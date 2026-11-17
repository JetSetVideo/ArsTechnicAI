// Pure math for canvas navigation gestures — trackpad pinch, two-finger pan,
// mouse wheel, Safari GestureEvent and touch pinch all reduce to these few
// functions, so the feel is identical on every browser and every screen size.
//
// Why the numbers:
// - Chrome, Edge and Firefox deliver a trackpad pinch as `wheel` events with
//   `ctrlKey: true` and `deltaY = -100 * ln(scale)`. Inverting that
//   (`exp(-deltaY / 100)`) makes the canvas follow the fingers exactly instead
//   of jumping a fixed step per event (the old 1.1× per event turned a gentle
//   pinch into a 2× zoom).
// - A mouse wheel notch with Ctrl/⌘ arrives as one large delta (≈100 px); the
//   per-event clamp keeps a notch at a comfortable 1.25× step.
// - Zoom is always anchored on the point under the cursor / between the
//   fingers, in canvas-local pixels, so nothing depends on the window size.

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

/** Lowest zoom anywhere — Fit included, so "zoom out" after Fit never zooms in. */
export const CANVAS_ZOOM_MIN = 0.15;
export const CANVAS_ZOOM_MAX = 2.5;
/** Fit-to-view never magnifies a small graph beyond this. */
export const FIT_ZOOM_MAX = 1.4;
/** Largest zoom change a single wheel event may cause (mouse notch). */
export const WHEEL_ZOOM_STEP_MAX = 1.25;
/** Zoom step of the toolbar buttons and keyboard shortcuts. */
export const BUTTON_ZOOM_STEP = 1.2;
/** Arrow-key pan step in screen pixels (Shift multiplies by 4). */
export const KEY_PAN_STEP = 60;

/**
 * What one wheel event should do. Pure, so the decision that fixes "pinch
 * zooms the whole page" is unit-tested, not only the maths after it.
 * - canvas-zoom / canvas-pan: preventDefault and move the canvas
 * - block: preventDefault, do nothing (a pinch over a panel, a busy canvas)
 * - native: let the browser have it (a panel scrolling itself, or undoing a
 *   page zoom the user already has — otherwise they could never get back)
 */
export type WheelIntent = 'canvas-zoom' | 'canvas-pan' | 'block' | 'native';

export function wheelIntent(input: {
  ctrlKey: boolean;
  metaKey: boolean;
  deltaY: number;
  overOverlay: boolean;
  innerScrollable: boolean;
  gestureActive: boolean;
  enabled: boolean;
  pageZoomed: boolean;
}): WheelIntent {
  if (input.ctrlKey || input.metaKey) {
    if (input.pageZoomed && input.deltaY > 0) return 'native';
    if (input.overOverlay || input.gestureActive || !input.enabled) return 'block';
    return 'canvas-zoom';
  }
  if (input.overOverlay || input.innerScrollable) return 'native';
  if (!input.enabled) return 'block';
  return 'canvas-pan';
}

/** A trackpad pinch arrives as ctrl+wheel without ⌘ (⌘+scroll is a real scroll). */
export function isPinchWheel(event: { ctrlKey: boolean; metaKey: boolean }): boolean {
  return event.ctrlKey && !event.metaKey;
}

/** WheelEvent.deltaMode values (DOM_DELTA_PIXEL / LINE / PAGE). */
const DELTA_LINE = 1;
const DELTA_PAGE = 2;
const LINE_PX = 16;

export function clampZoom(zoom: number, min = CANVAS_ZOOM_MIN, max = CANVAS_ZOOM_MAX): number {
  if (!Number.isFinite(zoom)) return min;
  return Math.min(max, Math.max(min, zoom));
}

/** Converts any wheel delta (pixels, lines, pages) to pixels. */
export function wheelDeltaPixels(
  event: { deltaX: number; deltaY: number; deltaMode?: number },
  pagePx = 800,
): { dx: number; dy: number } {
  const unit = event.deltaMode === DELTA_LINE ? LINE_PX : event.deltaMode === DELTA_PAGE ? pagePx : 1;
  return { dx: (event.deltaX || 0) * unit, dy: (event.deltaY || 0) * unit };
}

/** Zoom multiplier for one ctrl/⌘ wheel event (trackpad pinch or mouse notch). */
export function wheelZoomFactor(deltaYPx: number, maxStep = WHEEL_ZOOM_STEP_MAX): number {
  if (!Number.isFinite(deltaYPx) || deltaYPx === 0) return 1;
  const factor = Math.exp(-deltaYPx / 100);
  return Math.min(maxStep, Math.max(1 / maxStep, factor));
}

/**
 * Chromium (Chrome, Edge, Brave, Arc, Opera) divides the pinch's ctrl+wheel
 * delta by devicePixelRatio — measured: a 1.4× pinch reports ΣdeltaY −33.65
 * at DPR 1, −16.82 at DPR 2, −11.22 at DPR 3. Multiplying back makes one
 * pinch zoom the same amount on a Retina laptop and on a 1080p monitor, and
 * at any browser zoom level. Firefox does not divide; Safari uses
 * GestureEvent.scale instead.
 */
export function zoomDeltaScale(userAgent: string, devicePixelRatio: number): number {
  const chromium = /(Chrome|Chromium|CriOS|Edg)\//.test(userAgent);
  if (!chromium || !Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) return 1;
  return devicePixelRatio;
}

/**
 * Sets the zoom to `nextZoom` (clamped) while keeping the canvas point under
 * the anchor (canvas-local pixels) fixed on screen.
 */
export function zoomAround(
  viewport: CanvasViewport,
  nextZoom: number,
  anchorX: number,
  anchorY: number,
  min = CANVAS_ZOOM_MIN,
  max = CANVAS_ZOOM_MAX,
): CanvasViewport {
  const zoom = clampZoom(nextZoom, min, max);
  if (!viewport.zoom || zoom === viewport.zoom) return { ...viewport, zoom };
  const ratio = zoom / viewport.zoom;
  return {
    zoom,
    x: anchorX - ratio * (anchorX - viewport.x),
    y: anchorY - ratio * (anchorY - viewport.y),
  };
}

/** Pans by a scroll delta: content moves opposite to the scroll, like a page. */
export function panByScroll(viewport: CanvasViewport, dx: number, dy: number): CanvasViewport {
  return { ...viewport, x: viewport.x - dx, y: viewport.y - dy };
}

/**
 * Two-point pinch (touch): the world point that was under the starting
 * midpoint stays under the current midpoint, scaled by the finger distance.
 */
export function pinchViewport(
  start: CanvasViewport,
  startDistance: number,
  startMid: { x: number; y: number },
  distance: number,
  mid: { x: number; y: number },
  min = CANVAS_ZOOM_MIN,
  max = CANVAS_ZOOM_MAX,
): CanvasViewport {
  if (!(startDistance > 0) || !start.zoom) return start;
  const zoom = clampZoom(start.zoom * (distance / startDistance), min, max);
  const worldX = (startMid.x - start.x) / start.zoom;
  const worldY = (startMid.y - start.y) / start.zoom;
  return { zoom, x: mid.x - worldX * zoom, y: mid.y - worldY * zoom };
}

// ── Focus: center / fit a node or group ─────────────────────────────────────

/** A rectangle in scene (canvas world) units. */
export interface SceneRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Default double-click window (ms); the user can change it in Settings. */
export const DOUBLE_CLICK_MS_DEFAULT = 400;
export const DOUBLE_CLICK_MS_MIN = 150;
export const DOUBLE_CLICK_MS_MAX = 900;
/** Two clicks further apart than this (screen px) are two single clicks. */
export const DOUBLE_CLICK_SLOP_PX = 6;
/** Margin kept around a node or group fitted by a double-click (screen px). */
export const FOCUS_PADDING_PX = 48;

export function unionRects(rects: readonly SceneRect[]): SceneRect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.w));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Same zoom, the rectangle's centre moved to the centre of the view. */
export function centerOnRect(viewport: CanvasViewport, rect: SceneRect, view: { w: number; h: number }): CanvasViewport {
  const zoom = viewport.zoom || 1;
  return {
    zoom,
    x: view.w / 2 - (rect.x + rect.w / 2) * zoom,
    y: view.h / 2 - (rect.y + rect.h / 2) * zoom,
  };
}

/** Zoom so the rectangle fills the view (with padding), then centre it. */
export function fitRect(
  rect: SceneRect,
  view: { w: number; h: number },
  padding = FOCUS_PADDING_PX,
  min = CANVAS_ZOOM_MIN,
  max = CANVAS_ZOOM_MAX,
): CanvasViewport {
  const usableW = Math.max(1, view.w - padding * 2);
  const usableH = Math.max(1, view.h - padding * 2);
  const zoom = clampZoom(Math.min(usableW / Math.max(1, rect.w), usableH / Math.max(1, rect.h)), min, max);
  return centerOnRect({ x: 0, y: 0, zoom }, rect, view);
}

export interface ClickStamp {
  key: string;
  at: number;
  x: number;
  y: number;
}

/** True when `next` completes a double-click on the same target within the window. */
export function isDoubleClick(
  previous: ClickStamp | null,
  next: ClickStamp,
  windowMs: number,
  slopPx = DOUBLE_CLICK_SLOP_PX,
): boolean {
  if (!previous || previous.key !== next.key) return false;
  const elapsed = next.at - previous.at;
  if (elapsed < 0 || elapsed > windowMs) return false;
  return Math.hypot(next.x - previous.x, next.y - previous.y) <= slopPx;
}

export function clampDoubleClickMs(ms: unknown): number {
  const value = typeof ms === 'number' && Number.isFinite(ms) ? ms : DOUBLE_CLICK_MS_DEFAULT;
  return Math.min(DOUBLE_CLICK_MS_MAX, Math.max(DOUBLE_CLICK_MS_MIN, Math.round(value)));
}

/**
 * Viewport part-way between two views. Zoom moves in log space so zooming in
 * and out feel equally fast; the pan follows the screen-space path so the
 * target glides to the centre instead of swinging.
 */
export function interpolateViewport(from: CanvasViewport, to: CanvasViewport, t: number): CanvasViewport {
  const k = Math.min(1, Math.max(0, t));
  const zoom = Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * k);
  return { zoom, x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
}
