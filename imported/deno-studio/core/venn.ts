/**
 * venn.ts — the dual-circle propagation model.
 *
 * Every effect in this system has to answer one question before it runs:
 * *where does this apply*. The brief names four answers over two regions A and
 * B — union, intersection, and both differences — and they are exactly the
 * four regions of a two-set Venn diagram, so the model is that diagram.
 *
 * ## What A and B actually are
 *
 * A and B are `Mask` signals: single-channel 8-bit coverage — two *independent*
 * regions, typically a SAM3 / GrabCut subject matte and a second matte naming
 * some part of the scene. With A = "the sky" and B = "the bride":
 *
 *   - `union`        both regions together
 *   - `intersection` where she overlaps the sky — the boundary a bad matte shows in
 *   - `differenceA`  sky with her held out
 *   - `differenceB`  her with the sky held out
 *
 * ## The degenerate pairing, stated because it is the tempting one
 *
 * It is natural to reach for A = the whole frame, B = the subject, and read the
 * four modes as everything / subject / background / subject-again. Three of
 * those are right and the fourth is not: if A covers every pixel then
 * `B \ A = B ∩ ¬A = 0`, so "subject only" comes back empty, always.
 *
 * The mode that actually isolates the subject under that pairing is
 * `intersection`, and the mode that isolates the background is `differenceA`.
 * `differenceB` is not a fourth answer there — it is the same question asked
 * backwards, and the honest output is nothing. `describePairing()` below
 * detects this case from the measured coverage so the UI can say which modes
 * are meaningful instead of letting a user wonder why their subject vanished.
 *
 * ## Soft masks, and why the operators are what they are
 *
 * A matte from GrabCut is not binary — it is feathered at the edge, and that
 * feather is what stops a lifted subject from looking cut out with scissors.
 * So the set operators must be defined over the continuous interval [0,1],
 * and the choice of algebra shows up directly in the picture:
 *
 *   - Intersection as `min(a,b)`, not `a·b`. Multiplication *darkens* the
 *     overlap of two half-covered edges to 0.25, eating the feather and
 *     leaving a visible seam. `min` is idempotent — `min(a,a) === a` — so
 *     intersecting a mask with itself is a no-op, as it must be.
 *   - Union as `max(a,b)`, not `a+b-ab`, for the mirror reason.
 *   - Difference as `min(a, 1-b)`, which is intersection with the complement,
 *     so the identity `A\B === A ∩ ¬B` holds numerically and not just in prose.
 *
 * Together these are the Zadeh fuzzy-set operators, and they are the standard
 * choice in compositing precisely because they preserve edges.
 *
 * [AGENT-VOCABULARY] `differenceA` means "A minus B" — the region in A alone.
 * The name states which operand *survives*, because "left difference" depends
 * on how the diagram happens to be drawn and would flip the meaning of a saved
 * project if the layout ever changed.
 */

/** The four regions of a two-set diagram. */
export type PropagationMode =
  /** A ∪ B — the full set. Every frame and every background. */
  | "union"
  /** A ∩ B — the overlap only. */
  | "intersection"
  /** A \ B — the part of A that B does not cover. */
  | "differenceA"
  /** B \ A — the part of B that A does not cover. */
  | "differenceB";

export const PROPAGATION_MODES: readonly PropagationMode[] = [
  "union",
  "intersection",
  "differenceA",
  "differenceB",
] as const;

/** UI-facing description of each mode. Primary typography — hard-coded labels. */
export interface PropagationDescriptor {
  readonly mode: PropagationMode;
  /** Set-theoretic notation, shown on the node card. */
  readonly notation: string;
  readonly label: string;
  /** What this does to footage, in the operator's language, not the mathematician's. */
  readonly effect: string;
}

export const PROPAGATION_DESCRIPTORS: Readonly<Record<PropagationMode, PropagationDescriptor>> = {
  union: {
    mode: "union",
    notation: "A ∪ B",
    label: "Both regions",
    effect: "Applies wherever either region reaches — the two mattes added together.",
  },
  intersection: {
    mode: "intersection",
    notation: "A ∩ B",
    label: "Overlap",
    effect:
      "Applies only where the two regions coincide. With A left as the whole frame, this is what isolates B.",
  },
  differenceA: {
    mode: "differenceA",
    notation: "A \\ B",
    label: "A without B",
    effect: "Applies to A with B held out. With A as the whole frame, this is the background.",
  },
  differenceB: {
    mode: "differenceB",
    notation: "B \\ A",
    label: "B without A",
    effect:
      "Applies to B with A held out. Empty whenever A covers the whole frame — use Overlap there instead.",
  },
};

/** Coverage in the closed interval [0,1]. */
export type Coverage = number;

export const clampCoverage = (value: number): Coverage =>
  !Number.isFinite(value) ? 0 : value < 0 ? 0 : value > 1 ? 1 : value;

/**
 * Evaluate one mode at one sample of A and B.
 *
 * This is the reference definition. `combineMasks` below is the same algebra
 * over a whole buffer, and `tests/venn_test.ts` asserts they agree — a scalar
 * reference that the bulk path is checked against is how this stays correct
 * when the bulk path is later replaced by a shader.
 */
export function propagate(mode: PropagationMode, a: Coverage, b: Coverage): Coverage {
  const ca = clampCoverage(a);
  const cb = clampCoverage(b);
  switch (mode) {
    case "union":
      return Math.max(ca, cb);
    case "intersection":
      return Math.min(ca, cb);
    case "differenceA":
      return Math.min(ca, 1 - cb);
    case "differenceB":
      return Math.min(cb, 1 - ca);
  }
}

/**
 * Apply a mode across two 8-bit coverage buffers.
 *
 * Works in 0..255 integers throughout rather than converting to float and
 * back: a 4K matte is 8.3M samples per frame, and the round trip costs more
 * than the operation. `255 - b` is the exact 8-bit complement of `1 - b`, so
 * the algebra is preserved bit for bit.
 *
 * @throws RangeError when the two buffers differ in length — silently
 *         processing the shorter one would mask a resolution mismatch upstream
 *         and produce a matte that is subtly wrong everywhere.
 */
export function combineMasks(
  mode: PropagationMode,
  a: Uint8Array,
  b: Uint8Array,
  out: Uint8Array = new Uint8Array(a.length),
): Uint8Array {
  if (a.length !== b.length) {
    throw new RangeError(
      `Mask sizes disagree: A has ${a.length} samples, B has ${b.length}. ` +
        "Both mattes must be at the same resolution before they can be combined.",
    );
  }
  if (out.length !== a.length) {
    throw new RangeError(`Output buffer holds ${out.length} samples, expected ${a.length}.`);
  }
  switch (mode) {
    case "union":
      for (let i = 0; i < a.length; i++) out[i] = Math.max(a[i]!, b[i]!);
      break;
    case "intersection":
      for (let i = 0; i < a.length; i++) out[i] = Math.min(a[i]!, b[i]!);
      break;
    case "differenceA":
      for (let i = 0; i < a.length; i++) out[i] = Math.min(a[i]!, 255 - b[i]!);
      break;
    case "differenceB":
      for (let i = 0; i < a.length; i++) out[i] = Math.min(b[i]!, 255 - a[i]!);
      break;
  }
  return out;
}

/**
 * The share of the frame a mode selects, 0..1.
 *
 * Shown live on the node card, because "this grade touches 4% of the picture"
 * is the single most useful thing to know before committing a two-minute
 * render — and the number that catches an inverted matte immediately.
 */
export function coverageFraction(mode: PropagationMode, a: Uint8Array, b: Uint8Array): number {
  if (a.length === 0) return 0;
  if (a.length !== b.length) {
    throw new RangeError(`Mask sizes disagree: ${a.length} vs ${b.length}.`);
  }
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i]! / 255;
    const bv = b[i]! / 255;
    total += propagate(mode, av, bv);
  }
  return total / a.length;
}

/**
 * The four regions as fractions, in one pass.
 *
 * Used to drive the Venn control itself: each region is drawn with its own
 * true area, so the diagram on screen is a measurement of the current frame
 * rather than a generic icon of two overlapping circles.
 */
export function regionFractions(
  a: Uint8Array,
  b: Uint8Array,
): Readonly<Record<PropagationMode, number>> {
  if (a.length !== b.length) {
    throw new RangeError(`Mask sizes disagree: ${a.length} vs ${b.length}.`);
  }
  let union = 0, intersection = 0, diffA = 0, diffB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i]! / 255;
    const bv = b[i]! / 255;
    union += Math.max(av, bv);
    intersection += Math.min(av, bv);
    diffA += Math.min(av, 1 - bv);
    diffB += Math.min(bv, 1 - av);
  }
  const n = Math.max(1, a.length);
  return {
    union: union / n,
    intersection: intersection / n,
    differenceA: diffA / n,
    differenceB: diffB / n,
  };
}

/** What a given pair of mattes makes possible, and what it makes pointless. */
export interface PairingReport {
  /** Modes that select a non-empty region for this pair. */
  readonly meaningful: readonly PropagationMode[];
  /** Modes that are empty for this pair, with the reason stated. */
  readonly degenerate: ReadonlyArray<{ readonly mode: PropagationMode; readonly why: string }>;
  /** True when one operand covers essentially the whole frame. */
  readonly aIsFullFrame: boolean;
  readonly bIsFullFrame: boolean;
}

/** Coverage above which a matte is treated as covering the whole frame. */
const FULL_FRAME_THRESHOLD = 0.995;
/** Coverage below which a selected region is treated as empty. */
const EMPTY_THRESHOLD = 0.0005;

/**
 * Report which of the four modes actually select something, for this pair.
 *
 * Measured rather than inferred from how the node was wired, because a matte
 * that *should* be a subject can come back covering the frame when
 * segmentation fails — and that failure looks identical to a deliberate
 * whole-frame operand until someone looks at the numbers.
 */
export function describePairing(a: Uint8Array, b: Uint8Array): PairingReport {
  const fractions = regionFractions(a, b);
  let sumA = 0, sumB = 0;
  for (let i = 0; i < a.length; i++) {
    sumA += a[i]! / 255;
    sumB += b[i]! / 255;
  }
  const n = Math.max(1, a.length);
  const aIsFullFrame = sumA / n >= FULL_FRAME_THRESHOLD;
  const bIsFullFrame = sumB / n >= FULL_FRAME_THRESHOLD;

  const meaningful: PropagationMode[] = [];
  const degenerate: Array<{ mode: PropagationMode; why: string }> = [];

  for (const mode of PROPAGATION_MODES) {
    if (fractions[mode] > EMPTY_THRESHOLD) {
      meaningful.push(mode);
      continue;
    }
    const why = mode === "differenceB" && aIsFullFrame
      ? "A covers the whole frame, so nothing lies in B alone. Use Overlap to isolate B."
      : mode === "differenceA" && bIsFullFrame
      ? "B covers the whole frame, so nothing lies in A alone. Use Overlap to isolate A."
      : mode === "intersection"
      ? "The two regions do not overlap."
      : "This region is empty for the mattes currently wired.";
    degenerate.push({ mode, why });
  }
  return { meaningful, degenerate, aIsFullFrame, bIsFullFrame };
}
