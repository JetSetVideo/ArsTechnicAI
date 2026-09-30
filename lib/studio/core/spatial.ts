/**
 * spatial.ts — the 2D blueprint plane and its 2.5D depth extension.
 *
 * ## Why oblique projection and not a perspective camera
 *
 * The brief calls for Three.js. Axiom 1 (Gall's Law) and the Phase 1 rule
 * ("do not call external libraries if a custom light function suffices") say
 * to earn that dependency rather than assume it, so this module states the
 * case for the cheaper primitive.
 *
 * The canvas is a *blueprint*, not a scene. Its X/Y plane carries functional
 * node cards that must stay legible, clickable and text-selectable. Under a
 * perspective camera every card gets a different scale and a trapezoidal
 * footprint, so hit-testing needs an inverse projection per card, text needs
 * re-rasterising per depth, and a straight wire between two nodes stops being
 * a straight line on screen.
 *
 * Under **cabinet oblique projection** — the drafting convention this UI is
 * named after — X and Y stay screen-parallel and unscaled, and Z contributes
 * only a fixed 2D offset per unit depth:
 *
 *     screen = (x + z·k·cos θ,  y + z·k·sin θ)
 *
 * Depth is therefore an affine translation, hit-testing stays a rectangle
 * test in node-local space, wires stay straight, and text stays crisp. Depth
 * is communicated by *offset, scale-down and dimming* — the CD-carousel read —
 * rather than by foreshortening.
 *
 * Three.js earns its place at the moment we render actual footage as textured
 * quads with per-slice shaders. It does not earn its place to translate a
 * rectangle. This module is the boundary: `projectSlice` returns a plain 2x3
 * affine that a Canvas2D context, an SVG transform, or a Three.js
 * `Object3D.matrix` can all consume, so adopting Three.js later replaces the
 * *renderer* without touching the *layout*.
 *
 * [AGENT-DESIGNER] owns the constants in `DEFAULT_DEPTH_STYLE`.
 * [AGENT-VOCABULARY] every quantity below carries its unit in its name or doc.
 */

// ===========================================================================
// Vectors and rectangles
// ===========================================================================

/** A point or offset on the blueprint plane, in blueprint units (1 unit = 1 px at zoom 1). */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** A point in blueprint space plus its discrete depth slice. */
export interface Vec2Depth extends Vec2 {
  /** Integer slice index. 0 is the focused plane; positive recedes. */
  readonly z: number;
}

/** Axis-aligned rectangle in blueprint units. `w`/`h` are always >= 0. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const vec2 = (x: number, y: number): Vec2 => ({ x, y });
export const addVec = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const subVec = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scaleVec = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const lengthVec = (a: Vec2): number => Math.hypot(a.x, a.y);

export const rectRight = (r: Rect): number => r.x + r.w;
export const rectBottom = (r: Rect): number => r.y + r.h;
export const rectCentre = (r: Rect): Vec2 => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return !(
    rectRight(a) + gap <= b.x ||
    rectRight(b) + gap <= a.x ||
    rectBottom(a) + gap <= b.y ||
    rectBottom(b) + gap <= a.y
  );
}

export function rectContains(r: Rect, p: Vec2): boolean {
  return p.x >= r.x && p.x <= rectRight(r) && p.y >= r.y && p.y <= rectBottom(r);
}

/** Smallest rectangle containing all inputs, or `null` for an empty list. */
export function boundingRect(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rects) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (rectRight(r) > maxX) maxX = rectRight(r);
    if (rectBottom(r) > maxY) maxY = rectBottom(r);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// ===========================================================================
// The blueprint grid
// ===========================================================================

/**
 * Grid geometry. `minor` is the snap quantum; `major` is drawn heavier every
 * `majorEvery` minor lines so the eye can count distance without a ruler.
 */
export interface GridSpec {
  /** Snap quantum, blueprint units. Must be > 0. */
  readonly minor: number;
  /** Heavier rule every N minor lines. Must be >= 1. */
  readonly majorEvery: number;
}

export const DEFAULT_GRID: GridSpec = { minor: 8, majorEvery: 8 };

export const snapScalar = (value: number, quantum: number): number =>
  quantum <= 0 ? value : Math.round(value / quantum) * quantum;

export const snapPoint = (p: Vec2, grid: GridSpec = DEFAULT_GRID): Vec2 => ({
  x: snapScalar(p.x, grid.minor),
  y: snapScalar(p.y, grid.minor),
});

/** Snap a rectangle's origin, leaving its size untouched. */
export const snapRect = (r: Rect, grid: GridSpec = DEFAULT_GRID): Rect => ({
  ...snapPoint(r, grid),
  w: r.w,
  h: r.h,
});

// ===========================================================================
// Mutual awareness: collision avoidance
// ===========================================================================

/**
 * Push `moving` clear of every rectangle in `fixed`, preserving a `gap`.
 *
 * The rule is *minimum displacement*: of the four directions that would free
 * the overlap, take the shortest. That makes a dragged node slide along the
 * edge it is pressed against rather than teleporting around the obstacle,
 * which is the behaviour that reads as "the elements are aware of each other"
 * instead of as a glitch.
 *
 * Resolution is iterative because freeing one overlap can create another in a
 * dense cluster. `maxPasses` bounds that: on giving up the node is left at its
 * last position rather than thrown somewhere arbitrary.
 *
 * [AGENT-SECURITY] Bounded by construction — no `while (overlapping)` loop can
 * hang the UI thread on a pathological layout.
 */
export function resolveCollisions(
  moving: Rect,
  fixed: readonly Rect[],
  options: { gap?: number; maxPasses?: number; grid?: GridSpec | null } = {},
): Rect {
  const gap = options.gap ?? 12;
  const maxPasses = options.maxPasses ?? 8;
  const grid = options.grid === undefined ? DEFAULT_GRID : options.grid;

  let current = moving;
  for (let pass = 0; pass < maxPasses; pass++) {
    let moved = false;
    for (const other of fixed) {
      if (!rectsOverlap(current, other, gap)) continue;
      current = pushClear(current, other, gap);
      moved = true;
    }
    if (!moved) break;
  }
  return grid ? snapRect(current, grid) : current;
}

/** Displace `a` out of `b` along the cheapest of the four axes. */
function pushClear(a: Rect, b: Rect, gap: number): Rect {
  const pushLeft = b.x - gap - rectRight(a); // negative
  const pushRight = rectRight(b) + gap - a.x; // positive
  const pushUp = b.y - gap - rectBottom(a); // negative
  const pushDown = rectBottom(b) + gap - a.y; // positive

  const candidates: ReadonlyArray<{ dx: number; dy: number }> = [
    { dx: pushLeft, dy: 0 },
    { dx: pushRight, dy: 0 },
    { dx: 0, dy: pushUp },
    { dx: 0, dy: pushDown },
  ];

  let best = candidates[0]!;
  let bestCost = Math.abs(best.dx) + Math.abs(best.dy);
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    const cost = Math.abs(c.dx) + Math.abs(c.dy);
    if (cost < bestCost) {
      best = c;
      bestCost = cost;
    }
  }
  return { x: a.x + best.dx, y: a.y + best.dy, w: a.w, h: a.h };
}

/**
 * Centre a set of rectangles inside a viewport and report the zoom that fits
 * them, so "frame all" is one deterministic function rather than a heuristic
 * scattered through the view code.
 *
 * @returns `pan` in blueprint units and `zoom` as a multiplier, clamped to
 *          `[minZoom, maxZoom]`. Returns identity for an empty selection.
 */
export function fitToViewport(
  rects: readonly Rect[],
  viewport: { w: number; h: number },
  options: { padding?: number; minZoom?: number; maxZoom?: number } = {},
): { pan: Vec2; zoom: number } {
  const padding = options.padding ?? 48;
  const minZoom = options.minZoom ?? 0.1;
  const maxZoom = options.maxZoom ?? 2.5;

  const bounds = boundingRect(rects);
  if (!bounds || viewport.w <= 0 || viewport.h <= 0) {
    return { pan: vec2(0, 0), zoom: 1 };
  }
  const usableW = Math.max(1, viewport.w - padding * 2);
  const usableH = Math.max(1, viewport.h - padding * 2);
  const raw = Math.min(usableW / Math.max(1, bounds.w), usableH / Math.max(1, bounds.h));
  const zoom = Math.min(maxZoom, Math.max(minZoom, raw));

  const c = rectCentre(bounds);
  return {
    pan: vec2(viewport.w / 2 - c.x * zoom, viewport.h / 2 - c.y * zoom),
    zoom,
  };
}

// ===========================================================================
// The Z axis: depth slices and the CD carousel
// ===========================================================================

/**
 * How depth is drawn. Every field is a *rendering* decision; none of them
 * affects evaluation, so a stack looks different without computing differently.
 */
export interface DepthStyle {
  /** Screen offset per unit depth, blueprint units, before rotation. */
  readonly stepPx: number;
  /** Direction of the depth offset, radians clockwise from +X. */
  readonly angleRad: number;
  /** Multiplicative scale applied per slice of depth. 1 = no shrink. */
  readonly scalePerStep: number;
  /** Opacity multiplier applied per slice of depth. */
  readonly opacityPerStep: number;
  /** Slices further than this from focus are not drawn at all. */
  readonly maxVisibleDepth: number;
  /** Minimum opacity, so a far slice stays a visible hint rather than vanishing. */
  readonly minOpacity: number;
}

/**
 * Cabinet projection at 45°, the drafting default: depth reads clearly without
 * the offset ever aligning with a horizontal or vertical wire and being
 * mistaken for one.
 */
export const DEFAULT_DEPTH_STYLE: DepthStyle = {
  stepPx: 26,
  angleRad: -Math.PI / 4,
  scalePerStep: 0.94,
  opacityPerStep: 0.78,
  maxVisibleDepth: 8,
  minOpacity: 0.06,
};

/**
 * A 2x3 affine, row-major, matching both `CanvasRenderingContext2D.setTransform`
 * and the SVG `matrix(a b c d e f)` argument order.
 */
export interface Affine2x3 {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

export const IDENTITY_AFFINE: Affine2x3 = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** Everything a renderer needs to draw one depth slice. */
export interface SliceTransform {
  /** Slice index relative to focus. 0 = focused, positive = behind. */
  readonly relativeDepth: number;
  readonly transform: Affine2x3;
  /** 0..1. Already floored at `minOpacity`. */
  readonly opacity: number;
  /** True only for `relativeDepth === 0`. Only this slice takes pointer events. */
  readonly interactive: boolean;
}

/**
 * Project one depth slice to a 2D affine.
 *
 * Scaling is applied about `origin` so a stack shrinks *into* its own centre
 * rather than drifting toward the canvas origin — without this, a stack placed
 * far from (0,0) slides across the screen as it recedes.
 *
 * @param relativeDepth slice index relative to the focused slice; may be negative.
 * @param origin        the point the stack shrinks toward, in blueprint units.
 */
export function projectSlice(
  relativeDepth: number,
  origin: Vec2,
  style: DepthStyle = DEFAULT_DEPTH_STYLE,
): SliceTransform {
  const depth = relativeDepth;
  const magnitude = Math.abs(depth);
  const scale = Math.pow(style.scalePerStep, magnitude);
  const offsetLength = style.stepPx * depth;
  const dx = offsetLength * Math.cos(style.angleRad);
  const dy = offsetLength * Math.sin(style.angleRad);

  // Scale about `origin`, then translate along the depth axis.
  return {
    relativeDepth: depth,
    transform: {
      a: scale,
      b: 0,
      c: 0,
      d: scale,
      e: origin.x * (1 - scale) + dx,
      f: origin.y * (1 - scale) + dy,
    },
    opacity: Math.max(style.minOpacity, Math.pow(style.opacityPerStep, magnitude)),
    interactive: depth === 0,
  };
}

export const applyAffine = (m: Affine2x3, p: Vec2): Vec2 => ({
  x: m.a * p.x + m.c * p.y + m.e,
  y: m.b * p.x + m.d * p.y + m.f,
});

/**
 * Invert a 2x3 affine, or return `null` when it is singular.
 *
 * Needed to turn a pointer position back into blueprint coordinates. Slices
 * built by `projectSlice` are never singular (scale is a positive power), but
 * a caller may compose transforms, so the degenerate case is handled rather
 * than assumed away.
 */
export function invertAffine(m: Affine2x3): Affine2x3 | null {
  const det = m.a * m.d - m.b * m.c;
  if (det === 0 || !Number.isFinite(det)) return null;
  const inv = 1 / det;
  return {
    a: m.d * inv,
    b: -m.b * inv,
    c: -m.c * inv,
    d: m.a * inv,
    e: (m.c * m.f - m.d * m.e) * inv,
    f: (m.b * m.e - m.a * m.f) * inv,
  };
}

/**
 * A Z-axis stack: an ordered run of depth slices with one in focus.
 *
 * The canonical use is a temporal loop — one slice per frame of a range, the
 * same sub-graph evaluated at each — but the structure is deliberately about
 * *ordered alternatives*, so stacked versions of one node use it unchanged.
 */
export interface StackSpec {
  /** Total slices. Must be >= 1. */
  readonly sliceCount: number;
  /** Index of the slice in focus, 0-based. */
  readonly focusIndex: number;
  /** When true, focus wraps past either end — the carousel roll. */
  readonly wrap: boolean;
}

/**
 * Move the focus by `delta` slices.
 *
 * Wrapping uses `((n % m) + m) % m` rather than `n % m`, because JavaScript's
 * `%` keeps the sign of the dividend and would return a negative index when
 * rolling backwards past zero.
 */
export function rollFocus(spec: StackSpec, delta: number): StackSpec {
  const count = Math.max(1, Math.floor(spec.sliceCount));
  const target = spec.focusIndex + Math.trunc(delta);
  const focusIndex = spec.wrap
    ? ((target % count) + count) % count
    : Math.min(count - 1, Math.max(0, target));
  return { ...spec, sliceCount: count, focusIndex };
}

/**
 * Every slice a renderer should draw, nearest-to-camera last so a plain
 * back-to-front painter's-algorithm loop produces the correct overlap.
 *
 * Slices beyond `maxVisibleDepth` are dropped here rather than in the
 * renderer: a 4000-frame loop stack must cost the same to draw as a 12-frame
 * one, and that guarantee belongs with the geometry, not with each view.
 */
export function visibleSlices(
  spec: StackSpec,
  origin: Vec2,
  style: DepthStyle = DEFAULT_DEPTH_STYLE,
): SliceTransform[] {
  const count = Math.max(1, Math.floor(spec.sliceCount));
  const focus = Math.min(count - 1, Math.max(0, Math.floor(spec.focusIndex)));
  const out: SliceTransform[] = [];
  for (let i = 0; i < count; i++) {
    const relative = i - focus;
    if (Math.abs(relative) > style.maxVisibleDepth) continue;
    out.push(projectSlice(relative, origin, style));
  }
  // Furthest first; the focused slice is painted last and sits on top.
  out.sort((p, q) => Math.abs(q.relativeDepth) - Math.abs(p.relativeDepth));
  return out;
}
