/**
 * config.ts — what a shot is, before anything renders it.
 *
 * A `CinemaConfig` is the whole specification of an image: which body, which
 * glass, which stock, which instrument lit it, how the camera moved, what the
 * frame does. It is deliberately *not* a prompt. A prompt is a rendering of
 * one of these (`prompt.ts`), and the same config renders differently for
 * Midjourney, FLUX and Wan — which is exactly why the config has to exist
 * separately from the string.
 *
 * ## Why every field is a closed vocabulary
 *
 * Ported from Director's Console's Cinema Prompt Engineering schemas. Its
 * premise is that a configuration should only be expressible if it could have
 * been *shot*: no Panavision glass on an ARRI body, no LED panel on a 1940s
 * set, no handheld IMAX. That premise only holds if every field ranges over a
 * finite, known set — free text would let any of those back in through a typo.
 * The sets live in `gen/cinema_vocabulary.ts`, generated from the library, so
 * this file states *structure* only and never repeats a term.
 *
 * [AGENT-VOCABULARY] The two modes do not share a config type. Live action has
 * a body and a stock; animation has a line treatment and a motion style, and
 * asking an animation config for its film stock is a category error rather
 * than a `null`. `CinemaConfig` is the discriminated union of the two, tagged
 * by `mode`, and every consumer switches on that tag.
 */

import type {
  AnimationMedium,
  AspectRatio,
  CameraBody,
  CameraManufacturer,
  CameraType,
  ColorApplication,
  ColorTone,
  Composition,
  FilmStock,
  LensFamily,
  LensManufacturer,
  LightingModel,
  LightingSource,
  LightingStyle,
  LineTreatment,
  Mood,
  MotionStyle,
  MovementEquipment,
  MovementTiming,
  MovementType,
  SensorSize,
  ShotSize,
  StyleDomain,
  SurfaceDetail,
  TimeOfDay,
  VirtualCamera,
  WeightClass,
} from "../../gen/cinema_vocabulary.ts";

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/**
 * The part of a shot that is the same whether a camera or a pencil made it.
 *
 * Shot size, composition, mood and colour survive the live-action/animation
 * split intact — a close-up is a close-up either way — so they are one type
 * both configs embed rather than two that have to be kept parallel.
 */
export interface VisualGrammar {
  readonly shotSize: ShotSize;
  readonly composition: Composition;
  readonly mood: Mood;
  readonly colorTone: ColorTone;
}

export const DEFAULT_VISUAL_GRAMMAR: VisualGrammar = Object.freeze({
  shotSize: "MS",
  composition: "Rule_of_Thirds",
  mood: "Contemplative",
  colorTone: "Neutral_Saturated",
});

// ---------------------------------------------------------------------------
// Live action
// ---------------------------------------------------------------------------

export interface CameraConfig {
  readonly cameraType: CameraType;
  readonly manufacturer: CameraManufacturer;
  readonly body: CameraBody;
  readonly sensor: SensorSize;
  /**
   * Derived from `body` in practice — `weightClass()` in `rules.ts` is the
   * authority — but carried on the config so a user can override it for a rig
   * the vocabulary does not know about. The rules read the *derived* value.
   */
  readonly weightClass: WeightClass;
  /** `None` on a digital body. A rule refuses any other combination. */
  readonly filmStock: FilmStock;
  readonly aspectRatio: AspectRatio;
}

export interface LensConfig {
  readonly manufacturer: LensManufacturer;
  readonly family: LensFamily;
  /** Millimetres, 8–1200. Outside that is not a lens anyone has built. */
  readonly focalLengthMm: number;
  readonly isAnamorphic: boolean;
  /** Anamorphic squeeze, e.g. 2.0 or 1.33. Absent on spherical glass. */
  readonly squeezeRatio?: number;
}

export interface MovementConfig {
  readonly equipment: MovementEquipment;
  readonly movementType: MovementType;
  readonly timing: MovementTiming;
}

export interface LightingConfig {
  readonly timeOfDay: TimeOfDay;
  readonly source: LightingSource;
  readonly style: LightingStyle;
}

export interface LiveActionConfig {
  readonly mode: "live_action";
  readonly camera: CameraConfig;
  readonly lens: LensConfig;
  readonly movement: MovementConfig;
  readonly lighting: LightingConfig;
  readonly visualGrammar: VisualGrammar;
  /** The film this was seeded from, if any — `blade_runner`, `casablanca`. */
  readonly filmPreset?: string;
  /**
   * The era the shot is meant to belong to, which is what makes the
   * anachronism rules decidable: an HMI in a `Pre_1950` picture is an error
   * only because the config says which decade it is claiming to be.
   */
  readonly era?: string;
}

export const DEFAULT_LIVE_ACTION: LiveActionConfig = Object.freeze({
  mode: "live_action",
  camera: Object.freeze({
    cameraType: "Digital",
    manufacturer: "ARRI",
    body: "Alexa_35",
    sensor: "Super35",
    weightClass: "Medium",
    filmStock: "None",
    aspectRatio: "2.39:1",
  }),
  lens: Object.freeze({
    manufacturer: "ARRI",
    family: "ARRI_Signature_Prime",
    focalLengthMm: 50,
    isAnamorphic: false,
  }),
  movement: Object.freeze({
    equipment: "Static",
    movementType: "Static",
    timing: "Static",
  }),
  lighting: Object.freeze({
    timeOfDay: "Afternoon",
    source: "Sun",
    style: "Naturalistic",
  }),
  visualGrammar: DEFAULT_VISUAL_GRAMMAR,
});

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

export interface RenderingConfig {
  readonly lineTreatment: LineTreatment;
  readonly colorApplication: ColorApplication;
  readonly lightingModel: LightingModel;
  readonly surfaceDetail: SurfaceDetail;
}

export interface MotionConfig {
  readonly motionStyle: MotionStyle;
  readonly virtualCamera: VirtualCamera;
}

export interface AnimationConfig {
  readonly mode: "animation";
  readonly medium: AnimationMedium;
  readonly styleDomain: StyleDomain;
  readonly rendering: RenderingConfig;
  readonly motion: MotionConfig;
  readonly visualGrammar: VisualGrammar;
  /** `Studio_Ghibli`, `Pixar`, `Shonen` — the preset this was seeded from. */
  readonly stylePreset?: string;
}

export const DEFAULT_ANIMATION: AnimationConfig = Object.freeze({
  mode: "animation",
  medium: "2D",
  styleDomain: "Anime",
  rendering: Object.freeze({
    lineTreatment: "Clean",
    colorApplication: "Cel",
    lightingModel: "Naturalistic_Simulated",
    surfaceDetail: "Smooth",
  }),
  motion: Object.freeze({
    motionStyle: "Full",
    virtualCamera: "Digital_Pan",
  }),
  visualGrammar: DEFAULT_VISUAL_GRAMMAR,
});

// ---------------------------------------------------------------------------
// The union
// ---------------------------------------------------------------------------

export type CinemaConfig = LiveActionConfig | AnimationConfig;

export const isLiveAction = (c: CinemaConfig): c is LiveActionConfig => c.mode === "live_action";
export const isAnimation = (c: CinemaConfig): c is AnimationConfig => c.mode === "animation";

// ---------------------------------------------------------------------------
// Validation results
// ---------------------------------------------------------------------------

/**
 * How much a rule cares.
 *
 * `hard` means the configuration could not have been shot and the app should
 * refuse it. `warning` means it could, but it fights itself — a cheerful mood
 * on low-key lighting. `info` is a note a cinematographer would make and a
 * generator can safely ignore.
 *
 * Kept as three levels rather than valid/invalid for the same reason the
 * graph compiler grades its diagnostics: a warning that blocks is a warning
 * users learn to route around, and a hard rule that only warns is not a rule.
 */
export type RuleSeverity = "hard" | "warning" | "info";

export interface ValidationMessage {
  readonly ruleId: string;
  readonly severity: RuleSeverity;
  readonly message: string;
  /** Dotted path to the offending field, e.g. `lighting.source`, for the UI. */
  readonly fieldPath?: string;
}

export type ValidationStatus = "valid" | "warning" | "invalid";

export interface ValidationResult {
  readonly status: ValidationStatus;
  readonly messages: readonly ValidationMessage[];
  /** True when applying a preset had to move a field the user had set. */
  readonly autoCorrectionsApplied: boolean;
}
