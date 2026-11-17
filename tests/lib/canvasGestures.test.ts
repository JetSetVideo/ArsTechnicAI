import { describe, expect, it } from 'vitest';
import {
  CANVAS_ZOOM_MAX,
  CANVAS_ZOOM_MIN,
  clampZoom,
  FIT_ZOOM_MAX,
  isPinchWheel,
  panByScroll,
  pinchViewport,
  wheelDeltaPixels,
  wheelIntent,
  wheelZoomFactor,
  WHEEL_ZOOM_STEP_MAX,
  zoomAround,
  zoomDeltaScale,
  centerOnRect,
  fitRect,
  unionRects,
  interpolateViewport,
  isDoubleClick,
  clampDoubleClickMs,
  DOUBLE_CLICK_MS_DEFAULT,
  DOUBLE_CLICK_MS_MIN,
  DOUBLE_CLICK_MS_MAX,
} from '../../lib/canvas/gestures';

const toWorld = (vp: { x: number; y: number; zoom: number }, sx: number, sy: number) => ({
  x: (sx - vp.x) / vp.zoom,
  y: (sy - vp.y) / vp.zoom,
});

describe('wheelZoomFactor', () => {
  it('follows the fingers: Chrome encodes a pinch as deltaY = -100·ln(scale)', () => {
    expect(wheelZoomFactor(-100 * Math.log(1.1))).toBeCloseTo(1.1, 10);
    expect(wheelZoomFactor(-100 * Math.log(0.95))).toBeCloseTo(0.95, 10);
  });

  it('makes a tiny trackpad delta a tiny zoom, not a fixed 10% jump', () => {
    const factor = wheelZoomFactor(-2);
    expect(factor).toBeGreaterThan(1);
    expect(factor).toBeLessThan(1.03);
  });

  it('caps a mouse notch to one comfortable step in each direction', () => {
    expect(wheelZoomFactor(-120)).toBe(WHEEL_ZOOM_STEP_MAX);
    expect(wheelZoomFactor(120)).toBeCloseTo(1 / WHEEL_ZOOM_STEP_MAX, 10);
  });

  it('ignores zero and garbage deltas', () => {
    expect(wheelZoomFactor(0)).toBe(1);
    expect(wheelZoomFactor(Number.NaN)).toBe(1);
    expect(wheelZoomFactor(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('is symmetric: pinch out then the same pinch in returns to the start', () => {
    expect(wheelZoomFactor(-7) * wheelZoomFactor(7)).toBeCloseTo(1, 12);
  });
});

describe('zoomDeltaScale', () => {
  const chrome = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
  const edge = `${chrome} Edg/141.0.0.0`;
  const safari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
  const firefox = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0';

  it('restores Chromium pinch deltas divided by devicePixelRatio (measured 33.65 → 16.82 at DPR 2)', () => {
    const measured = { 1: -33.65, 2: -16.82, 3: -11.22 } as const;
    for (const dpr of [1, 2, 3] as const) {
      const factor = wheelZoomFactor(measured[dpr] * zoomDeltaScale(chrome, dpr), 10);
      expect(factor).toBeCloseTo(1.4, 2);
    }
    expect(zoomDeltaScale(edge, 2)).toBe(2);
    expect(zoomDeltaScale('Mozilla/5.0 AppleWebKit/537.36 HeadlessChrome/145.0.0.0 Safari/537.36', 2)).toBe(2);
  });

  it('leaves Safari and Firefox untouched', () => {
    expect(zoomDeltaScale(safari, 2)).toBe(1);
    expect(zoomDeltaScale(firefox, 2)).toBe(1);
  });

  it('survives a bogus devicePixelRatio', () => {
    expect(zoomDeltaScale(chrome, 0)).toBe(1);
    expect(zoomDeltaScale(chrome, Number.NaN)).toBe(1);
  });
});

describe('wheelDeltaPixels', () => {
  it('passes pixel deltas through', () => {
    expect(wheelDeltaPixels({ deltaX: 3, deltaY: -4, deltaMode: 0 })).toEqual({ dx: 3, dy: -4 });
  });
  it('converts Firefox line deltas', () => {
    expect(wheelDeltaPixels({ deltaX: 0, deltaY: 3, deltaMode: 1 })).toEqual({ dx: 0, dy: 48 });
  });
  it('converts page deltas with the given page size', () => {
    expect(wheelDeltaPixels({ deltaX: 0, deltaY: 1, deltaMode: 2 }, 500)).toEqual({ dx: 0, dy: 500 });
  });
});

describe('zoomAround', () => {
  it('keeps the canvas point under the cursor fixed', () => {
    const vp = { x: 60, y: 40, zoom: 0.85 };
    const before = toWorld(vp, 300, 200);
    const next = zoomAround(vp, 1.7, 300, 200);
    const after = toWorld(next, 300, 200);
    expect(next.zoom).toBe(1.7);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it('scales around the anchor, independent of where the canvas sits on screen', () => {
    // Same canvas-local anchor, two very different viewports: the anchored
    // world point stays put in both.
    for (const vp of [{ x: 0, y: 0, zoom: 1 }, { x: -1800, y: 640, zoom: 0.4 }]) {
      const before = toWorld(vp, 100, 100);
      const after = toWorld(zoomAround(vp, vp.zoom * 2, 100, 100), 100, 100);
      expect(after.x).toBeCloseTo(before.x, 10);
      expect(after.y).toBeCloseTo(before.y, 10);
    }
  });

  it('clamps to the zoom limits and does not drift at the limit', () => {
    const atMax = { x: 10, y: 20, zoom: CANVAS_ZOOM_MAX };
    expect(zoomAround(atMax, 99, 400, 300)).toEqual(atMax);
    const atMin = { x: 10, y: 20, zoom: CANVAS_ZOOM_MIN };
    expect(zoomAround(atMin, 0.001, 400, 300)).toEqual(atMin);
  });
});

describe('panByScroll', () => {
  it('moves content opposite to the scroll, like a page', () => {
    expect(panByScroll({ x: 0, y: 0, zoom: 1 }, 10, -20)).toEqual({ x: -10, y: 20, zoom: 1 });
  });
});

describe('pinchViewport (touch)', () => {
  it('zooms by the finger-distance ratio around the midpoint', () => {
    const start = { x: 0, y: 0, zoom: 1 };
    const mid = { x: 200, y: 150 };
    const next = pinchViewport(start, 100, mid, 200, mid);
    expect(next.zoom).toBe(2);
    const w0 = toWorld(start, mid.x, mid.y);
    const w1 = toWorld(next, mid.x, mid.y);
    expect(w1.x).toBeCloseTo(w0.x, 10);
    expect(w1.y).toBeCloseTo(w0.y, 10);
  });

  it('pans with the midpoint while pinching', () => {
    const start = { x: 0, y: 0, zoom: 1 };
    const next = pinchViewport(start, 100, { x: 100, y: 100 }, 100, { x: 130, y: 90 });
    expect(next).toEqual({ x: 30, y: -10, zoom: 1 });
  });

  it('refuses a degenerate start distance', () => {
    const start = { x: 5, y: 5, zoom: 1 };
    expect(pinchViewport(start, 0, { x: 0, y: 0 }, 50, { x: 0, y: 0 })).toBe(start);
  });
});

describe('clampZoom', () => {
  it('maps NaN to the minimum instead of poisoning the viewport', () => {
    expect(clampZoom(Number.NaN)).toBe(CANVAS_ZOOM_MIN);
  });

  it('shares one floor with Fit, so zoom-out after Fit never zooms in', () => {
    expect(CANVAS_ZOOM_MIN).toBeLessThanOrEqual(0.15);
    expect(FIT_ZOOM_MAX).toBeLessThanOrEqual(CANVAS_ZOOM_MAX);
    const fitted = { x: 0, y: 0, zoom: CANVAS_ZOOM_MIN };
    expect(zoomAround(fitted, fitted.zoom / 1.2, 0, 0).zoom).toBe(CANVAS_ZOOM_MIN);
  });
});

describe('wheelIntent — who gets a wheel event', () => {
  const base = {
    ctrlKey: false, metaKey: false, deltaY: -5, overOverlay: false, innerScrollable: false,
    gestureActive: false, enabled: true, pageZoomed: false,
  };

  it('a trackpad pinch on the canvas zooms the canvas (and so is prevented from zooming the page)', () => {
    expect(wheelIntent({ ...base, ctrlKey: true })).toBe('canvas-zoom');
    expect(wheelIntent({ ...base, metaKey: true })).toBe('canvas-zoom');
  });

  it('a pinch over a panel inside the canvas is blocked: neither the page nor the canvas zooms', () => {
    expect(wheelIntent({ ...base, ctrlKey: true, overOverlay: true })).toBe('block');
  });

  it('a pinch while Safari is already handling a gesture, or while the canvas is busy, is blocked', () => {
    expect(wheelIntent({ ...base, ctrlKey: true, gestureActive: true })).toBe('block');
    expect(wheelIntent({ ...base, ctrlKey: true, enabled: false })).toBe('block');
  });

  it('a page that is already pinch-zoomed can be zoomed back out by the browser', () => {
    expect(wheelIntent({ ...base, ctrlKey: true, pageZoomed: true, deltaY: 4 })).toBe('native');
    expect(wheelIntent({ ...base, ctrlKey: true, pageZoomed: true, deltaY: -4 })).toBe('canvas-zoom');
  });

  it('two-finger scroll pans the canvas, but a panel or a scrollable list scrolls itself', () => {
    expect(wheelIntent(base)).toBe('canvas-pan');
    expect(wheelIntent({ ...base, overOverlay: true })).toBe('native');
    expect(wheelIntent({ ...base, innerScrollable: true })).toBe('native');
    expect(wheelIntent({ ...base, enabled: false })).toBe('block');
  });
});

describe('isPinchWheel', () => {
  it('only ctrl without ⌘ is a pinch — ⌘+scroll is a real scroll and gets no DPR boost', () => {
    expect(isPinchWheel({ ctrlKey: true, metaKey: false })).toBe(true);
    expect(isPinchWheel({ ctrlKey: false, metaKey: true })).toBe(false);
    expect(isPinchWheel({ ctrlKey: true, metaKey: true })).toBe(false);
  });
});

describe('focus: center and fit', () => {
  const view = { w: 1000, h: 500 };
  const rect = { x: 200, y: 100, w: 292, h: 200 };
  const centreOnScreen = (vp: { x: number; y: number; zoom: number }) => ({
    x: vp.x + (rect.x + rect.w / 2) * vp.zoom,
    y: vp.y + (rect.y + rect.h / 2) * vp.zoom,
  });

  it('center keeps the zoom and puts the rectangle in the middle of the view', () => {
    const next = centerOnRect({ x: -50, y: 30, zoom: 0.6 }, rect, view);
    expect(next.zoom).toBe(0.6);
    expect(centreOnScreen(next).x).toBeCloseTo(500, 9);
    expect(centreOnScreen(next).y).toBeCloseTo(250, 9);
  });

  it('fit zooms so the rectangle fills the view inside the padding, centred', () => {
    const next = fitRect(rect, view, 48);
    expect(next.zoom).toBeCloseTo(Math.min((1000 - 96) / 292, (500 - 96) / 200), 9);
    expect(centreOnScreen(next).x).toBeCloseTo(500, 9);
    expect(centreOnScreen(next).y).toBeCloseTo(250, 9);
  });

  it('fit respects the zoom limits for tiny and huge targets', () => {
    expect(fitRect({ x: 0, y: 0, w: 2, h: 2 }, view).zoom).toBe(CANVAS_ZOOM_MAX);
    expect(fitRect({ x: 0, y: 0, w: 1e6, h: 1e6 }, view).zoom).toBe(CANVAS_ZOOM_MIN);
  });

  it('unions rectangles', () => {
    expect(unionRects([{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: -5, w: 5, h: 5 }])).toEqual({ x: 0, y: -5, w: 25, h: 15 });
    expect(unionRects([])).toBeNull();
  });

  it('interpolates zoom in log space and lands exactly on the target', () => {
    const from = { x: 0, y: 0, zoom: 0.5 };
    const to = { x: 100, y: -40, zoom: 2 };
    expect(interpolateViewport(from, to, 0.5).zoom).toBeCloseTo(1, 9);
    expect(interpolateViewport(from, to, 1)).toEqual(to);
    expect(interpolateViewport(from, to, 0)).toEqual(from);
  });
});

describe('double-click rule (Settings → double-click speed)', () => {
  const first = { key: 'node:a', at: 1000, x: 10, y: 10 };

  it('two clicks on the same target inside the window are a double-click', () => {
    expect(isDoubleClick(first, { ...first, at: 1300 }, 400)).toBe(true);
  });

  it('a slower second click, another target, or a moved pointer is not', () => {
    expect(isDoubleClick(first, { ...first, at: 1450 }, 400)).toBe(false);
    expect(isDoubleClick(first, { ...first, key: 'node:b', at: 1100 }, 400)).toBe(false);
    expect(isDoubleClick(first, { ...first, at: 1100, x: 30 }, 400)).toBe(false);
    expect(isDoubleClick(null, first, 400)).toBe(false);
  });

  it('the setting changes the outcome: 450 ms apart is double at 600, single at 300', () => {
    const second = { ...first, at: 1450 };
    expect(isDoubleClick(first, second, clampDoubleClickMs(600))).toBe(true);
    expect(isDoubleClick(first, second, clampDoubleClickMs(300))).toBe(false);
  });

  it('clamps bad stored values', () => {
    expect(clampDoubleClickMs(undefined)).toBe(DOUBLE_CLICK_MS_DEFAULT);
    expect(clampDoubleClickMs(5)).toBe(DOUBLE_CLICK_MS_MIN);
    expect(clampDoubleClickMs(99999)).toBe(DOUBLE_CLICK_MS_MAX);
  });
});
