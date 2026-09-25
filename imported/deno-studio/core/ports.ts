/**
 * ports.ts — the typed signal model.
 *
 * A port is a socket on a node card. Connecting two ports is the single act
 * that builds a pipeline, so this is where type safety, range safety and the
 * colour-coding rule all have to land — a wrong connection must be impossible
 * to *make*, not merely reported after the fact.
 *
 * [AGENT-VOCABULARY] `SignalKind` is a closed union. Adding a kind is a
 * deliberate edit here, and the compiler then lists every switch that must
 * learn about it. A `string` type would have let node authors invent
 * near-synonyms ("img", "image", "frame") that never connect.
 */

import type { NodeId, PortId } from "./ids.ts";

/**
 * What flows down a wire.
 *
 * `Image` is one RGB frame; `Sequence` is an ordered run of them and is what a
 * Z-stack iterates over. They are distinct kinds precisely so that dropping a
 * whole reel into a single-frame input is a compile-time-shaped error rather
 * than an out-of-memory at render time.
 */
export type SignalKind =
  /** One BGR frame buffer, 8-bit, as the engine holds it. */
  | "Image"
  /** An ordered, lazily-evaluated run of frames. The Z axis iterates this. */
  | "Sequence"
  /** Single-channel 8-bit coverage, 0..255. The SAM3/GrabCut matte type. */
  | "Mask"
  /** A dense per-pixel 2-channel displacement field, in pixels. */
  | "Flow"
  /** A named parameter bundle destined for one pipeline stage. */
  | "Params"
  /** A scalar, bounded by its port's `range`. */
  | "Number"
  /** A boolean switch. */
  | "Flag"
  /** Free text — prompts, specifications, file paths. */
  | "Text"
  /** One of a closed set of options declared on the port. */
  | "Enum"
  /** Measured statistics about a frame or a range: the analysis pass output. */
  | "Metrics"
  /**
   * A shot specification plus the prose and parameters that go with it — what
   * a library card hands to a generate node.
   *
   * Distinct from `Params`, which is a *stage's* settings bound for the
   * restoration engine. A Style is structured intent that has not chosen a
   * model yet; conflating the two would let a film reference be wired into a
   * CLAHE stage, which means nothing.
   */
  | "Style"
  /** An encoded moving-image clip with its own timebase, as a model returns it. */
  | "Video"
  /** An encoded audio buffer — dialogue, effects, or music. */
  | "Audio"
  /** A 3D mesh with its materials. */
  | "Mesh";

export const SIGNAL_KINDS: readonly SignalKind[] = [
  "Image",
  "Sequence",
  "Mask",
  "Flow",
  "Params",
  "Number",
  "Flag",
  "Text",
  "Enum",
  "Metrics",
  "Style",
  "Video",
  "Audio",
  "Mesh",
] as const;

/**
 * The wire colour for each signal kind.
 *
 * [AGENT-DESIGNER] This map is the origin of the colour-coding rule: a
 * variable chip rendered anywhere on the canvas must read its colour from
 * here, via `signalColour`, and never restate a hex literal. That is what
 * makes "the chip matches the node card it came from" a structural property
 * rather than a convention someone has to remember.
 */
export const SIGNAL_COLOUR: Readonly<Record<SignalKind, string>> = {
  Image: "#4da3d8", // cyan — picture. Matches the restorer's luminance trace.
  Sequence: "#5cbfa8", // teal — picture over time.
  Mask: "#c76a9f", // magenta — coverage.
  Flow: "#9b8cd4", // violet — motion. Matches the restorer's "authored by model".
  Params: "#e8a33d", // amber — settings. Matches the restorer's quality trace.
  Number: "#8fbf5a", // green — scalars.
  Flag: "#8fbf5a",
  Text: "#d4c25a", // ochre — language.
  Enum: "#d9705b", // terracotta — a closed choice.
  Metrics: "#d9705b",
  Style: "#c9a227", // gold — a reference's grant. Reads as "borrowed authority".
  Video: "#5cbfa8", // teal — picture over time, same family as Sequence.
  Audio: "#7fb3d5", // pale blue — the only non-visual signal on the canvas.
  Mesh: "#9b8cd4", // violet — geometry, same family as Flow.
};

export const signalColour = (kind: SignalKind): string => SIGNAL_COLOUR[kind];

/**
 * A closed numeric interval with a step, mirroring one control in
 * `shared/controls.json`.
 *
 * [AGENT-SECURITY] Every `Number` port carries one of these. The evaluator
 * refuses to run a node whose numeric input sits outside its range, so an
 * out-of-domain value cannot reach OpenCV — where, for instance, a CLAHE
 * `tile_grid` of 0 is a division by zero inside native code.
 */
export interface NumericRange {
  readonly min: number;
  readonly max: number;
  /** Quantum for UI stepping. `0` means continuous. */
  readonly step: number;
  /** Unit shown beside the value, e.g. `"px"`, `"fr"`, `"°"`. */
  readonly unit?: string;
  /**
   * Multiplier applied for *display only*; the stored and transmitted value
   * stays in the engine's own units.
   *
   * `stabilize.crop_ratio` is the case this exists for: the engine holds a
   * fraction 0…0.2 and its own UI shows it as a percentage. Without this the
   * two front-ends put different numbers on the same parameter, and a note
   * saying "crop at 4" would mean two different crops depending on which
   * window you read it in.
   */
  readonly displayScale?: number;
}

/** Which way a port faces. A wire always runs `output` → `input`. */
export type PortDirection = "input" | "output";

export interface PortSpec {
  readonly id: PortId;
  /** Primary-typography label — hard-coded, human, stable across projects. */
  readonly label: string;
  readonly direction: PortDirection;
  readonly kind: SignalKind;
  /**
   * One sentence answering *why this port exists*, shown on hover.
   * Required, not optional: an unexplained socket is a design defect.
   */
  readonly help: string;
  /** Present exactly when `kind === "Number"`. */
  readonly range?: NumericRange;
  /** Present exactly when `kind === "Enum"`; the closed option set. */
  readonly options?: readonly string[];
  /**
   * Value used when nothing is connected. `undefined` marks the port
   * *required* — the evaluator refuses to run the node without it.
   */
  readonly defaultValue?: SignalValue;
  /**
   * When true this input accepts several wires and receives them as an
   * ordered list. Used by compositing and stack-collect nodes.
   */
  readonly variadic?: boolean;
  /**
   * The node runs without this input.
   *
   * A port is required by default and a missing one is a compile error, which
   * is right for `image` on a stage and wrong for `reference` on a
   * text-to-image node: leaving it unwired is how you ask for text-to-image at
   * all. Optionality was previously inferred — Mask kinds and the `neighbours`
   * port were special-cased — so every other genuinely optional input reported
   * an error the user could not clear. Saying it on the port is both narrower
   * and readable on the card.
   */
  readonly optional?: boolean;
}

/**
 * A value in flight.
 *
 * Pixel-bearing kinds carry a `BufferId` handle rather than the pixels
 * themselves: buffers live in the lineage store, are immutable, and are
 * frequently larger than anything worth copying into a graph message.
 */
export type SignalValue =
  | { readonly kind: "Image"; readonly buffer: string }
  | { readonly kind: "Sequence"; readonly buffers: readonly string[] }
  | { readonly kind: "Mask"; readonly buffer: string }
  | { readonly kind: "Flow"; readonly buffer: string }
  | {
    readonly kind: "Params";
    readonly stage: string;
    readonly values: Readonly<Record<string, unknown>>;
  }
  | { readonly kind: "Number"; readonly value: number }
  | { readonly kind: "Flag"; readonly value: boolean }
  | { readonly kind: "Text"; readonly value: string }
  | { readonly kind: "Enum"; readonly value: string }
  | { readonly kind: "Metrics"; readonly values: Readonly<Record<string, number>> };

/** Why a proposed connection was refused. Rendered verbatim in the UI. */
export interface ConnectionRefusal {
  readonly reason:
    | "same-node"
    | "direction-mismatch"
    | "kind-mismatch"
    | "input-occupied"
    | "would-cycle";
  readonly message: string;
}

/**
 * Kind compatibility.
 *
 * Only one implicit widening is allowed — a single `Image` may feed a
 * `Sequence` input, becoming a run of length 1 — because it is unambiguous and
 * removes a pointless adapter node from every graph. Narrowing is *not*
 * allowed: a `Sequence` into an `Image` input would have to silently pick a
 * frame, and silently picking is exactly the black box this app exists to
 * avoid. `Mask` is not an `Image` even though both are pixels, because a
 * coverage channel and a picture are not interchangeable in any stage.
 */
export function kindAccepts(target: SignalKind, source: SignalKind): boolean {
  if (target === source) return true;
  if (target === "Sequence" && source === "Image") return true;
  // A Style is structured intent, and a Text input is the place intent ends up
  // when a node has no richer use for it — so a reference card can feed a bare
  // prompt field and lose only the structure. The reverse is refused: Text into
  // a Style input would mean inventing a camera, a stock and an era out of a
  // sentence, which is the guesswork the whole cinema layer exists to remove.
  if (target === "Text" && source === "Style") return true;
  return false;
}

/**
 * Decide whether one wire may exist. Cycle detection is *not* done here — it
 * needs the whole graph — so `graph.ts` layers `would-cycle` on top of this.
 */
export function checkConnection(
  from: { node: NodeId; port: PortSpec },
  to: { node: NodeId; port: PortSpec; occupied: boolean },
): ConnectionRefusal | null {
  if (from.node === to.node) {
    return { reason: "same-node", message: "A node cannot feed itself." };
  }
  if (from.port.direction !== "output" || to.port.direction !== "input") {
    return {
      reason: "direction-mismatch",
      message: "A wire runs from an output to an input.",
    };
  }
  if (!kindAccepts(to.port.kind, from.port.kind)) {
    const reelIntoFrame = from.port.kind === "Sequence" && to.port.kind === "Image";
    return {
      reason: "kind-mismatch",
      message: reelIntoFrame
        ? "A reel cannot feed a single-frame input. Wire it through Frame Selection."
        : `${from.port.kind} does not fit a ${to.port.kind} input.`,
    };
  }
  if (to.occupied && !to.port.variadic) {
    return {
      reason: "input-occupied",
      message: `${to.port.label} already has a source. Disconnect it first.`,
    };
  }
  return null;
}

/**
 * Clamp a number into its port's range and snap it to the declared step.
 *
 * Snapping is done relative to `min` rather than to zero, because a control
 * running 0.5..0.95 in steps of 0.01 would otherwise be able to land on 0.955.
 */
export const displayValue = (raw: number, range: NumericRange): number =>
  raw * (range.displayScale ?? 1);

export const storedValue = (shown: number, range: NumericRange): number =>
  shown / (range.displayScale ?? 1);

export function clampToRange(value: number, range: NumericRange): number {
  if (!Number.isFinite(value)) return range.min;
  const clamped = Math.min(range.max, Math.max(range.min, value));
  if (range.step <= 0) return clamped;
  const snapped = range.min + Math.round((clamped - range.min) / range.step) * range.step;
  const bounded = Math.min(range.max, Math.max(range.min, snapped));
  // Kill float dust from the division so the value serialises cleanly.
  return Number(bounded.toFixed(10));
}

/** A value that fell outside its declared domain, with the reason stated. */
export interface ValueViolation {
  readonly port: PortId;
  readonly message: string;
}

/**
 * Validate one value against the port that is about to receive it.
 * Returns `null` when the value is acceptable.
 */
export function validateValue(spec: PortSpec, value: SignalValue): ValueViolation | null {
  if (!kindAccepts(spec.kind, value.kind)) {
    return {
      port: spec.id,
      message: `${spec.label} expects ${spec.kind}, received ${value.kind}.`,
    };
  }
  if (value.kind === "Number" && spec.range) {
    const { min, max } = spec.range;
    if (!Number.isFinite(value.value) || value.value < min || value.value > max) {
      return {
        port: spec.id,
        message: `${spec.label} must be between ${min} and ${max}; received ${value.value}.`,
      };
    }
  }
  if (value.kind === "Enum" && spec.options && !spec.options.includes(value.value)) {
    return {
      port: spec.id,
      message: `${spec.label} must be one of ${
        spec.options.join(", ")
      }; received "${value.value}".`,
    };
  }
  return null;
}
