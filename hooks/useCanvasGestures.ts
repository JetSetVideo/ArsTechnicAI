import { useEffect, useRef, type RefObject } from 'react';
import {
  isPinchWheel,
  pinchViewport,
  panByScroll,
  wheelDeltaPixels,
  wheelIntent,
  wheelZoomFactor,
  zoomAround,
  zoomDeltaScale,
  type CanvasViewport,
} from '@/lib/canvas/gestures';

/**
 * Canvas navigation for laptops, desktops and tablets.
 *
 * - Trackpad pinch (Chrome/Edge/Firefox send ctrl+wheel) and ⌘/Ctrl + mouse
 *   wheel zoom the canvas around the cursor — never the page.
 * - Safari trackpad / iPad pinch arrive as GestureEvents; same result.
 * - Two-finger scroll and the mouse wheel pan; Shift + wheel pans sideways.
 * - Two-finger touch pinch zooms and pans together.
 * - Over an in-canvas panel (`overlaySelector`) the panel keeps its own
 *   scrolling and a pinch does nothing — panels do not start canvas gestures.
 *
 * The listeners are native and non-passive: React's `onWheel` is passive, so
 * it can never stop the browser's own page zoom. Updates are coalesced to one
 * per animation frame so a 120 Hz trackpad does not re-render 120 times.
 */
export interface CanvasGestureOptions {
  getViewport: () => CanvasViewport;
  setViewport: (viewport: CanvasViewport) => void;
  /** Returns false while another interaction owns the pointer (e.g. wiring). */
  enabled?: () => boolean;
  /** Elements inside the canvas that are panels, not canvas content. */
  overlaySelector?: string;
  /** Called when a touch pinch starts, so a marquee/drag can be abandoned. */
  onPinchStart?: () => void;
}

interface SafariGestureEvent extends UIEvent {
  scale: number;
  clientX: number;
  clientY: number;
}

const DEFAULT_OVERLAYS = '[data-canvas-overlay]';
/** A Safari gesture with no event for this long is treated as ended. */
const GESTURE_STALE_MS = 300;

/** True while the browser page itself is pinch-zoomed (visual viewport). */
function pageZoomed(): boolean {
  if (typeof window === 'undefined' || !window.visualViewport) return false;
  return window.visualViewport.scale > 1.01;
}

function scrollableAncestorCanTake(target: Element | null, root: Element, dx: number, dy: number): boolean {
  for (let el = target; el && el !== root; el = el.parentElement) {
    if (!(el instanceof HTMLElement)) continue;
    const style = getComputedStyle(el);
    const canY = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
    const canX = /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
    if (canY && dy !== 0) {
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((dy < 0 && !atTop) || (dy > 0 && !atBottom)) return true;
    }
    if (canX && dx !== 0) {
      const atLeft = el.scrollLeft <= 0;
      const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      if ((dx < 0 && !atLeft) || (dx > 0 && !atRight)) return true;
    }
  }
  return false;
}

export function useCanvasGestures(ref: RefObject<HTMLElement>, options: CanvasGestureOptions): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // One viewport write per animation frame. `pendingBase` is the store value
    // the pending one was built from: if anything else (Fit, minimap, toolbar,
    // undo) wrote the viewport in between, the stale gesture frame is dropped
    // instead of silently undoing that write.
    let pending: CanvasViewport | null = null;
    let pendingBase: CanvasViewport | null = null;
    let frame = 0;
    const current = () => pending ?? optionsRef.current.getViewport();
    const commit = (next: CanvasViewport) => {
      if (!pending) pendingBase = optionsRef.current.getViewport();
      pending = next;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const value = pending;
        const base = pendingBase;
        pending = null;
        pendingBase = null;
        if (value && optionsRef.current.getViewport() === base) optionsRef.current.setViewport(value);
      });
    };
    const isEnabled = () => optionsRef.current.enabled?.() ?? true;
    const overlayOf = (target: EventTarget | null) => {
      const selector = optionsRef.current.overlaySelector ?? DEFAULT_OVERLAYS;
      return target instanceof Element ? target.closest(selector) : null;
    };
    const local = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    // ── Safari: trackpad / iPad pinch ──────────────────────────────────────
    // `lastAt` lets a gesture whose gestureend never arrived (window blur,
    // target removed mid-pinch) expire instead of muting ⌘/Ctrl+wheel zoom.
    let safari: { startZoom: number; ignore: boolean; lastAt: number } | null = null;
    const gestureActive = () => !!safari && performance.now() - safari.lastAt < GESTURE_STALE_MS;
    const onGestureStart = (event: Event) => {
      // A page the user already pinch-zoomed must stay un-zoomable.
      if (pageZoomed()) {
        safari = { startZoom: current().zoom, ignore: true, lastAt: performance.now() };
        return;
      }
      event.preventDefault();
      safari = {
        startZoom: current().zoom,
        // iPad Safari also sends touch pointers for the same pinch: one owner.
        ignore: !!overlayOf(event.target) || !isEnabled() || !!touchPinch,
        lastAt: performance.now(),
      };
    };
    const onGestureChange = (event: Event) => {
      if (safari?.ignore && pageZoomed()) return;
      event.preventDefault();
      if (!safari || safari.ignore || touchPinch) return;
      safari.lastAt = performance.now();
      const gesture = event as SafariGestureEvent;
      const at = local(gesture.clientX, gesture.clientY);
      commit(zoomAround(current(), safari.startZoom * gesture.scale, at.x, at.y));
    };
    const onGestureEnd = (event: Event) => {
      if (!pageZoomed()) event.preventDefault();
      safari = null;
    };
    const onBlur = () => { safari = null; };

    // ── Wheel: pinch (ctrl), ⌘/Ctrl + wheel, two-finger scroll, mouse wheel ─
    const onWheel = (event: WheelEvent) => {
      let { dx, dy } = wheelDeltaPixels(event, el.clientHeight);
      if (event.shiftKey && dx === 0) { dx = dy; dy = 0; }
      const intent = wheelIntent({
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        deltaY: event.deltaY,
        overOverlay: !!overlayOf(event.target),
        innerScrollable: scrollableAncestorCanTake(event.target as Element | null, el, dx, dy),
        gestureActive: gestureActive(),
        enabled: isEnabled(),
        pageZoomed: pageZoomed(),
      });
      if (intent === 'native') return;
      // Stops the browser's page zoom, and macOS swipe-back over the canvas.
      event.preventDefault();
      if (intent === 'canvas-pan') {
        commit(panByScroll(current(), dx, dy));
      } else if (intent === 'canvas-zoom') {
        const at = local(event.clientX, event.clientY);
        const viewport = current();
        const scale = isPinchWheel(event) ? zoomDeltaScale(navigator.userAgent, window.devicePixelRatio) : 1;
        const { dy: zoomDy } = wheelDeltaPixels(event, el.clientHeight);
        commit(zoomAround(viewport, viewport.zoom * wheelZoomFactor(zoomDy * scale), at.x, at.y));
      }
    };

    // ── Touch: two-finger pinch + pan ──────────────────────────────────────
    const touches = new Map<number, { x: number; y: number }>();
    let touchPinch: { start: CanvasViewport; distance: number; mid: { x: number; y: number } } | null = null;
    const geometry = () => {
      const [a, b] = Array.from(touches.values());
      return {
        distance: Math.hypot(b.x - a.x, b.y - a.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || overlayOf(event.target)) return;
      // A new first finger starts a new sequence: forget fingers whose
      // pointerup never reached us (element removed mid-touch).
      if (event.isPrimary) { touches.clear(); touchPinch = null; }
      touches.set(event.pointerId, local(event.clientX, event.clientY));
      if (touches.size === 2 && isEnabled()) {
        const { distance, mid } = geometry();
        touchPinch = { start: current(), distance, mid };
        if (safari) safari.ignore = true;
        optionsRef.current.onPinchStart?.();
      }
      if (touchPinch) event.stopPropagation();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !touches.has(event.pointerId)) return;
      touches.set(event.pointerId, local(event.clientX, event.clientY));
      if (!touchPinch || touches.size < 2) return;
      event.stopPropagation();
      const { distance, mid } = geometry();
      commit(pinchViewport(touchPinch.start, touchPinch.distance, touchPinch.mid, distance, mid));
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      touches.delete(event.pointerId);
      if (touches.size < 2) touchPinch = null;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart, { passive: false } as AddEventListenerOptions);
    el.addEventListener('gesturechange', onGestureChange, { passive: false } as AddEventListenerOptions);
    el.addEventListener('gestureend', onGestureEnd, { passive: false } as AddEventListenerOptions);
    el.addEventListener('pointerdown', onPointerDown, true);
    el.addEventListener('pointermove', onPointerMove, true);
    el.addEventListener('pointerup', onPointerEnd, true);
    el.addEventListener('pointercancel', onPointerEnd, true);
    window.addEventListener('blur', onBlur);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('blur', onBlur);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('pointermove', onPointerMove, true);
      el.removeEventListener('pointerup', onPointerEnd, true);
      el.removeEventListener('pointercancel', onPointerEnd, true);
    };
  }, [ref]);
}

/**
 * Stops pinch / Ctrl+wheel (and Firefox's ⌘+wheel) from zooming the whole
 * application page while it is mounted (the editor shell), and stops a
 * sideways two-finger swipe over the panels from navigating Back out of the
 * editor. Canvases zoom themselves via `useCanvasGestures`; panels and bars
 * stay at their designed size.
 * - A page that is already pinch-zoomed (carried from the dashboard, Smart
 *   Zoom) can still be zoomed back out — the guard never traps the user.
 * - Keyboard browser zoom (⌘ + / ⌘ −) is deliberately left alone for
 *   accessibility.
 */
export function usePreventPageZoom(): void {
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (pageZoomed() && event.deltaY > 0) return;
      event.preventDefault();
    };
    const onGesture = (event: Event) => {
      if (!pageZoomed()) event.preventDefault();
    };
    const opts = { passive: false } as AddEventListenerOptions;
    const root = document.documentElement;
    const previousOverscroll = root.style.overscrollBehaviorX;
    root.style.overscrollBehaviorX = 'none';
    window.addEventListener('wheel', onWheel, opts);
    document.addEventListener('gesturestart', onGesture, opts);
    document.addEventListener('gesturechange', onGesture, opts);
    document.addEventListener('gestureend', onGesture, opts);
    return () => {
      root.style.overscrollBehaviorX = previousOverscroll;
      window.removeEventListener('wheel', onWheel, opts);
      document.removeEventListener('gesturestart', onGesture, opts);
      document.removeEventListener('gesturechange', onGesture, opts);
      document.removeEventListener('gestureend', onGesture, opts);
    };
  }, []);
}
