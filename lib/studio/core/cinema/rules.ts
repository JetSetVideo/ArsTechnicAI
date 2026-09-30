/**
 * rules.ts — what could actually have been shot.
 *
 * 63 rules, ported from Director's Console's `cinema_rules/rules/engine.py`.
 * They answer one question: is this configuration something a crew could have
 * photographed? A Panavision body takes Panavision glass and nothing else. An
 * HMI did not exist before 1972. A 4 kg body does not go on a gimbal. Midday
 * does not produce moonlight.
 *
 * ## Why bother, when the model will draw it anyway
 *
 * A generative model will happily render "handheld IMAX at blue hour lit by
 * the sun", and the result will look like nothing, because the description
 * describes nothing. The value of the rules is not that they protect the
 * renderer — it is that they stop the *user* asking for an image that has no
 * referent. That is why the severities are graded rather than binary:
 *
 * - `hard`    — physically impossible. The prompt would be incoherent.
 * - `warning` — possible, but fighting itself. *Midsommar* is a cheerful mood
 *               under high-key daylight and it is deliberately unsettling; the
 *               rule fires and the user says yes, that is the point.
 * - `info`    — a note a cinematographer would make in passing.
 *
 * A hard rule that only warned would not be a rule; a warning that blocked
 * would be routed around within a day. The same reasoning as the graph
 * compiler's diagnostics in `bridge/engine.ts`.
 *
 * ## Fidelity
 *
 * Rule ids, severities, messages and field paths are the originals verbatim,
 * because the ids are what the UI keys off and the messages are what the user
 * reads. Declaration order is preserved too: `validate()` returns messages in
 * rule order, and a reordering would show the user a different first complaint
 * about the same shot. `tests/cinema_parity_test.ts` runs both engines over
 * generated configurations and fails on any divergence.
 *
 * [AGENT-VOCABULARY] Every rule is a pure predicate over a frozen config. No
 * rule reads the clock, the filesystem or the network, so validation is safe
 * to run on every keystroke — which is what the inspector does.
 */

import {
  FILM_CAMERA_BODIES,
  IMAX_CAMERAS,
  LARGE_FORMAT_CAMERAS,
  PANAVISION_CAMERA_BODIES,
  PANAVISION_LENS_FAMILIES,
} from "../../gen/cinema_compat.ts";
import { BODY_WEIGHT_CLASS } from "../../gen/cinema_compat.ts";
import type { CameraBody, WeightClass } from "../../gen/cinema_vocabulary.ts";
import type {
  AnimationConfig,
  CinemaConfig,
  LiveActionConfig,
  RuleSeverity,
  ValidationMessage,
  ValidationResult,
} from "./config.ts";
import {
  applyAnimationPreset,
  applyFilmPreset,
  presetConstraints,
  PresetIndex,
} from "./presets.ts";
import type { AnimationPreset, FilmPreset, PresetMappings } from "./presets.ts";

// ---------------------------------------------------------------------------
// Rule shape
// ---------------------------------------------------------------------------

/**
 * A rule fires when its `check` returns **true** — i.e. `check` describes the
 * *violation*, not the requirement.
 *
 * This inversion is inherited from the Python original and is worth keeping:
 * written the other way round every rule would need a negation, and a rule
 * whose predicate is `!(a && b)` is materially harder to read against a
 * message that says "a with b is impossible".
 */
interface Rule<C> {
  readonly ruleId: string;
  readonly severity: RuleSeverity;
  readonly message: string;
  readonly fieldPath?: string;
  readonly check: (config: C) => boolean;
}

export function weightClass(body: CameraBody): WeightClass {
  return BODY_WEIGHT_CLASS[body] ?? "UltraLight";
}

export const isFilmCamera = (body: CameraBody): boolean => FILM_CAMERA_BODIES.has(body);

/**
 * Does an era string denote a time before `year`?
 *
 * Eras are user-facing text — `"1940s"`, `"Silent Era"`, `"modern"` — because
 * they come from film presets that were written by hand. Matching is
 * substring-and-lowercase, and a decade is judged by its *midpoint*: "the
 * 1970s" straddles the 1972 arrival of the HMI, and treating the decade as a
 * point at 1975 says HMIs were available, which is right for most of it.
 *
 * An unrecognised era returns false — no anachronism is claimed for a period
 * the vocabulary does not know. Failing open is deliberate here: the
 * alternative is telling someone their custom era is impossible because the
 * table has not heard of it.
 */
export function eraBeforeYear(era: string, year: number): boolean {
  const lower = era.toLowerCase();

  const decades: ReadonlyArray<readonly [string, number]> = [
    ["1890s", 1895],
    ["1900s", 1905],
    ["1910s", 1915],
    ["1920s", 1925],
    ["1930s", 1935],
    ["1940s", 1945],
    ["1950s", 1955],
    ["1960s", 1965],
    ["1970s", 1975],
    ["1980s", 1985],
    ["1990s", 1995],
    ["2000s", 2005],
    ["2010s", 2015],
    ["2020s", 2025],
  ];
  for (const [decade, midpoint] of decades) {
    if (lower.includes(decade)) return midpoint < year;
  }

  const named: ReadonlyArray<readonly [string, number]> = [
    ["silent", 1920],
    ["golden age", 1950],
    ["classic hollywood", 1960],
    ["new hollywood", 1975],
    ["modern", 2020],
    ["contemporary", 2020],
  ];
  for (const [name, endYear] of named) {
    if (lower.includes(name)) return endYear < year;
  }

  return false;
}

const has = <T extends string>(set: readonly T[], value: string): boolean =>
  (set as readonly string[]).includes(value);

// ---------------------------------------------------------------------------
// Live-action rules — declaration order is the original's
// ---------------------------------------------------------------------------

const LARGE_FORMAT_STOCKS = ["Kodak_65mm_500T", "Kodak_65mm_250D", "Kodak_65mm_200T"] as const;
const IMAX_STOCKS = ["IMAX_500T", "IMAX_250D"] as const;

/** Only these cover the Alexa 65's XPL mount and 65 mm sensor. */
const ALEXA_65_LENSES = [
  "ARRI_Prime_65",
  "ARRI_Prime_DNA",
  "Panavision_Primo_70",
  "Hasselblad_V",
  "Vintage_Spherical",
] as const;

/** Super-35-only glass. It vignettes on a large-format sensor. */
const S35_ONLY_LENSES = [
  "ARRI_Ultra_Prime",
  "ARRI_Master_Prime",
  "Zeiss_Master_Prime",
  "Cooke_S4",
  "Panavision_Primo",
] as const;

const EIGHT_K_BODIES = ["V_Raptor", "V_Raptor_X", "V_Raptor_XL"] as const;

const JIB_MOVEMENTS = ["Crane_Up", "Crane_Down", "Arc", "Static"] as const;
const DRONE_MOVEMENTS = [
  "Track_In",
  "Track_Out",
  "Crane_Up",
  "Crane_Down",
  "Arc",
  "Static",
] as const;

export const LIVE_ACTION_RULES: readonly Rule<LiveActionConfig>[] = [
  {
    ruleId: "LA_DIGITAL_NO_FILM_STOCK",
    severity: "hard",
    message:
      "Film stock cannot be selected with digital cameras. Film stock is only for film cameras.",
    fieldPath: "camera.film_stock",
    check: (c) => !isFilmCamera(c.camera.body) && c.camera.filmStock !== "None",
  },
  {
    ruleId: "LA_FILM_REQUIRES_STOCK",
    severity: "hard",
    message: "Film cameras require a film stock selection.",
    fieldPath: "camera.film_stock",
    check: (c) => isFilmCamera(c.camera.body) && c.camera.filmStock === "None",
  },
  {
    ruleId: "LA_65MM_STOCK_REQUIRES_65MM_CAMERA",
    severity: "hard",
    message: "65mm/70mm film stocks require large format (65mm) cameras.",
    fieldPath: "camera.film_stock",
    check: (c) =>
      has(LARGE_FORMAT_STOCKS, c.camera.filmStock) && !LARGE_FORMAT_CAMERAS.has(c.camera.body),
  },
  {
    ruleId: "LA_IMAX_STOCK_REQUIRES_IMAX",
    severity: "hard",
    message: "IMAX film stocks require IMAX cameras.",
    fieldPath: "camera.film_stock",
    check: (c) => has(IMAX_STOCKS, c.camera.filmStock) && !IMAX_CAMERAS.has(c.camera.body),
  },
  {
    ruleId: "LA_ULTRA_PANAVISION_ASPECT",
    severity: "hard",
    message: "Ultra Panavision 70 cameras use 2.76:1 anamorphic aspect ratio.",
    fieldPath: "camera.aspect_ratio",
    check: (c) => c.camera.body === "Ultra_Panavision_70" && c.camera.aspectRatio !== "2.76:1",
  },
  {
    ruleId: "LA_IMAX_1570_ASPECT",
    severity: "warning",
    message: "IMAX 15/70 cameras typically use 1.43:1 aspect ratio for IMAX screens.",
    fieldPath: "camera.aspect_ratio",
    check: (c) =>
      (c.camera.body === "IMAX_MSM_9802" || c.camera.body === "IMAX_GT") &&
      c.camera.aspectRatio !== "1.43:1" && c.camera.aspectRatio !== "1.90:1",
  },
  {
    ruleId: "LA_276_REQUIRES_ULTRA_PV70",
    severity: "hard",
    message: "2.76:1 aspect ratio requires Ultra Panavision 70 camera system.",
    fieldPath: "camera.aspect_ratio",
    check: (c) => c.camera.aspectRatio === "2.76:1" && c.camera.body !== "Ultra_Panavision_70",
  },
  {
    ruleId: "LA_PANAVISION_CLOSED_ECOSYSTEM",
    severity: "hard",
    message: "Panavision cameras use proprietary mount. Only Panavision lenses are compatible.",
    fieldPath: "lens.family",
    check: (c) =>
      PANAVISION_CAMERA_BODIES.has(c.camera.body) && !PANAVISION_LENS_FAMILIES.has(c.lens.family),
  },
  {
    ruleId: "LA_PANAVISION_LENS_REQUIRES_PV_CAMERA",
    severity: "hard",
    message: "Panavision lenses require Panavision mount cameras.",
    fieldPath: "lens.family",
    // The Alexa 65 is excused: it takes Primo 70 through an adapter.
    check: (c) =>
      PANAVISION_LENS_FAMILIES.has(c.lens.family) &&
      !PANAVISION_CAMERA_BODIES.has(c.camera.body) &&
      c.camera.body !== "Alexa_65",
  },
  {
    ruleId: "LA_NIGHT_NO_SUN",
    severity: "hard",
    message: "Sunlight is not available at night.",
    fieldPath: "lighting.source",
    check: (c) => c.lighting.timeOfDay === "Night" && c.lighting.source === "Sun",
  },
  {
    ruleId: "LA_HEAVY_NO_HANDHELD",
    severity: "hard",
    message: "Heavy cameras (>4kg) cannot be operated handheld safely.",
    fieldPath: "movement.equipment",
    check: (c) => weightClass(c.camera.body) === "Heavy" && c.movement.equipment === "Handheld",
  },
  {
    ruleId: "LA_HEAVY_NO_GIMBAL",
    severity: "hard",
    message: "Heavy cameras (>4kg) exceed gimbal payload limits.",
    fieldPath: "movement.equipment",
    check: (c) => weightClass(c.camera.body) === "Heavy" && c.movement.equipment === "Gimbal",
  },
  {
    ruleId: "LA_HEAVY_NO_DRONE",
    severity: "hard",
    message: "Heavy cameras (>4kg) exceed standard drone payload limits.",
    fieldPath: "movement.equipment",
    check: (c) => weightClass(c.camera.body) === "Heavy" && c.movement.equipment === "Drone",
  },
  {
    ruleId: "LA_MEDIUM_HANDHELD_WARN",
    severity: "warning",
    message:
      "Medium-weight cameras (3-4kg) may cause operator fatigue during extended handheld work.",
    fieldPath: "movement.equipment",
    check: (c) => weightClass(c.camera.body) === "Medium" && c.movement.equipment === "Handheld",
  },
  {
    ruleId: "LA_CHEERFUL_LOWKEY_WARN",
    severity: "warning",
    message: "Cheerful mood with low-key lighting is atypical. Intentional subversion?",
    fieldPath: "lighting.style",
    check: (c) => c.visualGrammar.mood === "Cheerful" && c.lighting.style === "Low_Key",
  },
  {
    ruleId: "LA_ROMANTIC_LOWKEY_INFO",
    severity: "info",
    message: "Low-key lighting is traditional for romantic/sensual scenes.",
    fieldPath: "lighting.style",
    check: (c) => c.visualGrammar.mood === "Romantic" && c.lighting.style === "Low_Key",
  },
  {
    ruleId: "LA_ERA_HMI_ANACHRONISM",
    severity: "hard",
    message: "HMI lighting was invented in 1972. Not available for earlier eras.",
    fieldPath: "lighting.source",
    check: (c) => c.era !== undefined && eraBeforeYear(c.era, 1972) && c.lighting.source === "HMI",
  },
  {
    ruleId: "LA_ERA_KINO_ANACHRONISM",
    severity: "hard",
    message: "Kino Flo was founded in 1987. Not available for earlier eras.",
    fieldPath: "lighting.source",
    check: (c) =>
      c.era !== undefined && eraBeforeYear(c.era, 1987) && c.lighting.source === "Kino_Flo",
  },
  {
    ruleId: "LA_ERA_LED_ANACHRONISM",
    severity: "hard",
    message: "LED film lighting became available around 2002, widespread after 2012.",
    fieldPath: "lighting.source",
    check: (c) => c.era !== undefined && eraBeforeYear(c.era, 2002) && c.lighting.source === "LED",
  },
  {
    ruleId: "LA_MIDDAY_NO_LOWKEY",
    severity: "hard",
    message:
      "Low-key lighting is nearly impossible to achieve at midday without extensive control.",
    fieldPath: "lighting.style",
    check: (c) => c.lighting.timeOfDay === "Midday" && c.lighting.style === "Low_Key",
  },
  {
    ruleId: "LA_MIDDAY_NO_MOON",
    severity: "hard",
    message: "Moonlight cannot be the key light source during midday.",
    fieldPath: "lighting.source",
    check: (c) => c.lighting.timeOfDay === "Midday" && c.lighting.source === "Moon",
  },
  {
    ruleId: "LA_BLUEHOUR_NO_SUN",
    severity: "hard",
    message: "Direct sunlight is not available during blue hour (sun has set/not yet risen).",
    fieldPath: "lighting.source",
    check: (c) => c.lighting.timeOfDay === "Blue_Hour" && c.lighting.source === "Sun",
  },
  {
    ruleId: "LA_JIB_MOVEMENT_RESTRICT",
    severity: "hard",
    message: "Jib equipment can only perform Crane_Up, Crane_Down, and Arc movements.",
    fieldPath: "movement.movement_type",
    check: (c) => c.movement.equipment === "Jib" && !has(JIB_MOVEMENTS, c.movement.movementType),
  },
  {
    ruleId: "LA_DRONE_MOVEMENT_RESTRICT",
    severity: "hard",
    message:
      "Drone equipment is limited to aerial movement types: Track_In, Track_Out, Crane_Up, Crane_Down, Arc.",
    fieldPath: "movement.movement_type",
    check: (c) =>
      c.movement.equipment === "Drone" && !has(DRONE_MOVEMENTS, c.movement.movementType),
  },
  {
    ruleId: "LA_DOLLYZOOM_REQUIRES_DOLLY",
    severity: "hard",
    message: "Dolly zoom (Vertigo effect) requires dolly or slider equipment.",
    fieldPath: "movement.equipment",
    check: (c) =>
      c.movement.movementType === "Dolly_Zoom" &&
      c.movement.equipment !== "Dolly" && c.movement.equipment !== "Slider",
  },
  {
    ruleId: "LA_DOLLYZOOM_TIMING_WARN",
    severity: "warning",
    message: "Dolly zoom at fast timing is disorienting. Typically done at slow/moderate pace.",
    fieldPath: "movement.timing",
    check: (c) =>
      c.movement.movementType === "Dolly_Zoom" &&
      (c.movement.timing === "Fast" || c.movement.timing === "Whip_Fast"),
  },
  {
    ruleId: "LA_GLOOMY_HIGHKEY_WARN",
    severity: "warning",
    message: "Gloomy mood with high-key lighting is atypical. Low-key is more conventional.",
    fieldPath: "lighting.style",
    check: (c) => c.visualGrammar.mood === "Gloomy" && c.lighting.style === "High_Key",
  },
  {
    ruleId: "LA_HOPEFUL_LOWKEY_WARN",
    severity: "warning",
    message:
      "Hopeful mood with low-key lighting is atypical. High-key/soft lighting is conventional.",
    fieldPath: "lighting.style",
    check: (c) => c.visualGrammar.mood === "Hopeful" && c.lighting.style === "Low_Key",
  },
  {
    ruleId: "LA_WIDE_LENS_CU_WARN",
    severity: "warning",
    message:
      "Wide angle lens (<35mm) on close-up causes facial distortion. Intentional stylistic choice?",
    fieldPath: "lens.focal_length_mm",
    check: (c) =>
      c.lens.focalLengthMm < 35 &&
      (c.visualGrammar.shotSize === "CU" || c.visualGrammar.shotSize === "BCU" ||
        c.visualGrammar.shotSize === "ECU"),
  },
  {
    ruleId: "LA_LONG_LENS_WIDE_WARN",
    severity: "warning",
    message: "Long lens (>85mm) on wide shot creates strong compression. Unusual choice.",
    fieldPath: "lens.focal_length_mm",
    check: (c) =>
      c.lens.focalLengthMm > 85 &&
      (c.visualGrammar.shotSize === "EWS" || c.visualGrammar.shotSize === "WS"),
  },
  {
    ruleId: "LA_ALEXA65_LENS_RESTRICT",
    severity: "hard",
    message: "Alexa 65 (XPL mount, 65mm sensor) requires 65mm format lenses. " +
      "Compatible: ARRI Prime 65, ARRI Prime DNA, Panavision Primo 70, Hasselblad V.",
    fieldPath: "lens.family",
    check: (c) => c.camera.body === "Alexa_65" && !has(ALEXA_65_LENSES, c.lens.family),
  },
  {
    ruleId: "LA_LF_NO_S35_LENS",
    severity: "hard",
    message: "Large Format cameras require LF/FF coverage lenses. " +
      "S35-only lenses will vignette on LF sensors.",
    fieldPath: "lens.family",
    check: (c) =>
      (c.camera.body === "Alexa_LF" || c.camera.body === "Alexa_Mini_LF") &&
      has(S35_ONLY_LENSES, c.lens.family),
  },
  {
    ruleId: "LA_VINTAGE_HIGHRES_WARN",
    severity: "warning",
    message: "Vintage lenses may not resolve well on high-resolution sensors (8K+). " +
      "Chromatic aberration and softness may be more visible.",
    fieldPath: "lens.family",
    check: (c) =>
      (c.lens.family === "Vintage_Anamorphic" || c.lens.family === "Vintage_Spherical") &&
      has(EIGHT_K_BODIES, c.camera.body),
  },
  {
    ruleId: "LA_ANAMORPHIC_INFO",
    severity: "info",
    message:
      "Anamorphic lens selected. Remember to set 2x de-squeeze in post for proper aspect ratio.",
    fieldPath: "lens.is_anamorphic",
    check: (c) => c.lens.isAnamorphic === true,
  },
  {
    ruleId: "LA_SYMMETRY_ECU_WARN",
    severity: "warning",
    message:
      "Symmetrical composition is unusual for ECU - limited visual elements to arrange symmetrically.",
    fieldPath: "visual_grammar.composition",
    check: (c) =>
      c.visualGrammar.composition === "Symmetrical" && c.visualGrammar.shotSize === "ECU",
  },
  {
    ruleId: "LA_LEADING_LINES_CU_WARN",
    severity: "warning",
    message: "Leading Lines composition requires environmental context - atypical for close-ups.",
    fieldPath: "visual_grammar.composition",
    check: (c) =>
      c.visualGrammar.composition === "Leading_Lines" &&
      (c.visualGrammar.shotSize === "CU" || c.visualGrammar.shotSize === "BCU" ||
        c.visualGrammar.shotSize === "ECU"),
  },
  {
    ruleId: "LA_NEGATIVE_SPACE_ECU_WARN",
    severity: "warning",
    message: "Negative Space composition is difficult to achieve in ECU - subject fills frame.",
    fieldPath: "visual_grammar.composition",
    check: (c) =>
      c.visualGrammar.composition === "Negative_Space" && c.visualGrammar.shotSize === "ECU",
  },
  {
    ruleId: "LA_FRAME_WITHIN_FRAME_EWS_WARN",
    severity: "warning",
    message:
      "Frame Within Frame is harder to read at Extreme Wide distances - may lose visual impact.",
    fieldPath: "visual_grammar.composition",
    check: (c) =>
      c.visualGrammar.composition === "Frame_Within_Frame" && c.visualGrammar.shotSize === "EWS",
  },
  {
    ruleId: "LA_FILL_FRAME_WIDE_WARN",
    severity: "warning",
    message:
      "Fill The Frame composition contradicts Wide Shot framing - subject should dominate in FTF.",
    fieldPath: "visual_grammar.composition",
    check: (c) =>
      c.visualGrammar.composition === "Fill_The_Frame" &&
      (c.visualGrammar.shotSize === "WS" || c.visualGrammar.shotSize === "EWS" ||
        c.visualGrammar.shotSize === "MWS"),
  },
  {
    ruleId: "LA_DEPTH_LAYERING_ECU_WARN",
    severity: "warning",
    message: "Depth Layering requires multiple planes - difficult to achieve in extreme close-up.",
    fieldPath: "visual_grammar.composition",
    check: (c) =>
      c.visualGrammar.composition === "Depth_Layering" &&
      (c.visualGrammar.shotSize === "ECU" || c.visualGrammar.shotSize === "BCU"),
  },
];

// ---------------------------------------------------------------------------
// Animation rules
// ---------------------------------------------------------------------------

const SATURATED_TONES = ["Warm_Saturated", "Cool_Saturated", "Neutral_Saturated"] as const;

export const ANIMATION_RULES: readonly Rule<AnimationConfig>[] = [
  {
    ruleId: "ANIM_MANGA_MONOCHROME",
    severity: "hard",
    message: "Manga style must use Monochrome or Monochrome_Ink color application.",
    fieldPath: "rendering.color_application",
    check: (c) =>
      c.styleDomain === "Manga" &&
      c.rendering.colorApplication !== "Monochrome" &&
      c.rendering.colorApplication !== "Monochrome_Ink",
  },
  {
    ruleId: "ANIM_MANGA_LOCKED_CAMERA",
    severity: "hard",
    message: "Manga style must use Locked camera (static panels).",
    fieldPath: "motion.virtual_camera",
    check: (c) => c.styleDomain === "Manga" && c.motion.virtualCamera !== "Locked",
  },
  {
    ruleId: "ANIM_MANGA_GRAPHIC_LIGHT",
    severity: "hard",
    message: "Manga style requires Graphic lighting model (symbolic, not volumetric).",
    fieldPath: "rendering.lighting_model",
    check: (c) => c.styleDomain === "Manga" && c.rendering.lightingModel !== "Graphic",
  },
  {
    ruleId: "ANIM_MANGA_NO_MOTION",
    severity: "hard",
    message: "Manga style must have no motion (static panels).",
    fieldPath: "motion.motion_style",
    check: (c) => c.styleDomain === "Manga" && c.motion.motionStyle !== "None",
  },
  {
    ruleId: "ANIM_MANGA_REQUIRES_2D",
    severity: "hard",
    message: "Manga style requires 2D medium.",
    fieldPath: "medium",
    check: (c) => c.styleDomain === "Manga" && c.medium !== "2D",
  },
  {
    ruleId: "ANIM_ILLUSTRATION_STATIC",
    severity: "hard",
    message: "Illustration style must have no motion (static image).",
    fieldPath: "motion.motion_style",
    check: (c) => c.styleDomain === "Illustration" && c.motion.motionStyle !== "None",
  },
  {
    ruleId: "ANIM_ILLUSTRATION_LOCKED_CAMERA",
    severity: "hard",
    message: "Illustration style must use Locked camera (no temporal camera).",
    fieldPath: "motion.virtual_camera",
    check: (c) => c.styleDomain === "Illustration" && c.motion.virtualCamera !== "Locked",
  },
  {
    ruleId: "ANIM_2D_NO_FREE3D",
    severity: "hard",
    message: "2D animation cannot use Free 3D camera movement.",
    fieldPath: "motion.virtual_camera",
    check: (c) => c.medium === "2D" && c.motion.virtualCamera === "Free_3D",
  },
  {
    ruleId: "ANIM_3D_NO_FLAT_LIGHT",
    severity: "hard",
    message: "3D animation requires volumetric or simulated light, not Flat lighting.",
    fieldPath: "rendering.lighting_model",
    check: (c) => c.medium === "3D" && c.rendering.lightingModel === "Minimal",
  },
  {
    ruleId: "ANIM_3D_REQUIRES_CAMERA_OR_MOTION",
    severity: "hard",
    message: "3D animation requires spatial camera presence or motion.",
    fieldPath: "motion.virtual_camera",
    check: (c) =>
      c.medium === "3D" && c.motion.virtualCamera === "Locked" && c.motion.motionStyle === "None",
  },
  {
    ruleId: "ANIM_HYBRID_REQUIRES_3D_CAMERA",
    severity: "hard",
    message: "Hybrid 2D/3D animation requires Free 3D camera for volumetric movement.",
    fieldPath: "motion.virtual_camera",
    check: (c) => c.medium === "Hybrid" && c.motion.virtualCamera !== "Free_3D",
  },
  {
    ruleId: "ANIM_NO_MOTION_NO_CAMERA",
    severity: "hard",
    message: "Static motion style (None) cannot have camera movement.",
    fieldPath: "motion.virtual_camera",
    check: (c) =>
      c.motion.motionStyle === "None" &&
      c.motion.virtualCamera !== "Locked" && c.motion.virtualCamera !== "Motion_Comic",
  },
  {
    ruleId: "ANIM_ANIME_NO_PHOTOREAL",
    severity: "hard",
    message: "Anime does not use photorealistic rendering with naturalistic lighting.",
    fieldPath: "rendering.surface_detail",
    check: (c) =>
      c.styleDomain === "Anime" && c.rendering.surfaceDetail === "Photoreal" &&
      c.rendering.lightingModel === "Naturalistic_Simulated",
  },
  {
    ruleId: "ANIM_FULL_ANIMATION_NEEDS_COLOR",
    severity: "hard",
    message: "Full animation style typically requires color, not monochrome ink.",
    fieldPath: "rendering.color_application",
    check: (c) =>
      c.motion.motionStyle === "Full" && c.rendering.colorApplication === "Monochrome_Ink",
  },
  {
    ruleId: "ANIM_PHOTOREAL_LIMITED_WARN",
    severity: "warning",
    message: "Photorealistic surfaces with limited animation may expose motion imperfections.",
    fieldPath: "motion.motion_style",
    check: (c) => c.rendering.surfaceDetail === "Photoreal" && c.motion.motionStyle === "Limited",
  },
  {
    ruleId: "ANIM_SATURATED_GLOOMY_WARN",
    severity: "warning",
    message: "Highly saturated colors with gloomy mood is atypical - consider desaturated tones.",
    fieldPath: "visual_grammar.color_tone",
    check: (c) =>
      c.styleDomain === "Anime" && has(SATURATED_TONES, c.visualGrammar.colorTone) &&
      c.visualGrammar.mood === "Gloomy",
  },
  {
    ruleId: "ANIM_MANGA_CLEAN_MENACING_WARN",
    severity: "warning",
    message: "Menacing mood in manga usually benefits from heavier ink treatment.",
    fieldPath: "rendering.line_treatment",
    check: (c) =>
      c.styleDomain === "Manga" && c.rendering.lineTreatment === "Clean" &&
      c.visualGrammar.mood === "Menacing",
  },
  {
    ruleId: "ANIM_3D_RIM_CHEERFUL_WARN",
    severity: "warning",
    message: "Stylized rim lighting often implies drama or tension, atypical for cheerful mood.",
    fieldPath: "rendering.lighting_model",
    check: (c) =>
      c.medium === "3D" && c.rendering.lightingModel === "Stylized_Rim" &&
      c.visualGrammar.mood === "Cheerful",
  },
  {
    ruleId: "ANIM_ANIME_MONOCHROME_WARN",
    severity: "warning",
    message:
      "Monochrome color tone is atypical for anime - usually reserved for flashbacks or stylistic moments.",
    fieldPath: "visual_grammar.color_tone",
    check: (c) => c.styleDomain === "Anime" && c.visualGrammar.colorTone === "Monochrome",
  },
  {
    ruleId: "ANIM_SKETCHY_FULL_WARN",
    severity: "warning",
    message:
      "Sketchy line treatment with full animation is high production cost - consider limited animation.",
    fieldPath: "rendering.line_treatment",
    check: (c) => c.rendering.lineTreatment === "Sketchy" && c.motion.motionStyle === "Full",
  },
  {
    ruleId: "ANIM_ANIME_NO_SIMULATED_HANDHELD",
    severity: "hard",
    message:
      "Anime relies on controlled framing. Simulated Handheld camera breaks stylistic conventions.",
    fieldPath: "motion.virtual_camera",
    check: (c) => c.styleDomain === "Anime" && c.motion.virtualCamera === "Simulated_Handheld",
  },
  {
    ruleId: "ANIM_DREAMLIKE_HARSH_CONTRAST_WARN",
    severity: "warning",
    message:
      "Dreamlike mood favors softer tonal transitions. High contrast BW is harsh for dreamy aesthetics.",
    fieldPath: "visual_grammar.color_tone",
    check: (c) =>
      c.visualGrammar.mood === "Dreamlike" && c.visualGrammar.colorTone === "High_Contrast_BW",
  },
  {
    ruleId: "ANIM_ILLUSTRATION_DYNAMIC_STATIC_WARN",
    severity: "warning",
    message:
      "Dynamic/Diagonal composition implies motion energy, but Illustration has no motion. Intentional tension?",
    fieldPath: "visual_grammar.composition",
    check: (c) =>
      c.styleDomain === "Illustration" && c.visualGrammar.composition === "Diagonal" &&
      c.motion.motionStyle === "None",
  },
];

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

function evaluate<C>(rules: readonly Rule<C>[], config: C): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  for (const rule of rules) {
    if (!rule.check(config)) continue;
    messages.push(
      rule.fieldPath === undefined
        ? { ruleId: rule.ruleId, severity: rule.severity, message: rule.message }
        : {
          ruleId: rule.ruleId,
          severity: rule.severity,
          message: rule.message,
          fieldPath: rule.fieldPath,
        },
    );
  }
  return messages;
}

/**
 * Status is decided by the worst message present.
 *
 * `info` alone still reads as `valid`: an informational note is not a defect
 * and a UI that turned amber for "low-key is traditional for romantic scenes"
 * would teach people to stop reading the panel.
 */
export function summarise(
  messages: readonly ValidationMessage[],
  autoCorrectionsApplied = false,
): ValidationResult {
  const hasHard = messages.some((m) => m.severity === "hard");
  const hasWarning = messages.some((m) => m.severity === "warning");
  return {
    status: hasHard ? "invalid" : hasWarning ? "warning" : "valid",
    messages,
    autoCorrectionsApplied,
  };
}

/**
 * Preset vetoes run *after* the general rules, and the order is load-bearing:
 * the messages are shown in the order they arrive, and a user who picked
 * "Blade Runner" wants to read the physics complaint before the style one.
 * `PresetIndex.empty()` is the honest default — with no library loaded there
 * are no preset constraints to apply, which is different from there being none.
 */
export function validateLiveAction(
  config: LiveActionConfig,
  presets: PresetIndex = PresetIndex.empty(),
): ValidationResult {
  return summarise([
    ...evaluate(LIVE_ACTION_RULES, config),
    ...presetConstraints(config, presets),
  ]);
}

export function validateAnimation(
  config: AnimationConfig,
  presets: PresetIndex = PresetIndex.empty(),
): ValidationResult {
  return summarise([
    ...evaluate(ANIMATION_RULES, config),
    ...presetConstraints(config, presets),
  ]);
}

/** Dispatch on the config's own tag, so callers need not know which mode they hold. */
export function validate(
  config: CinemaConfig,
  presets: PresetIndex = PresetIndex.empty(),
): ValidationResult {
  return config.mode === "live_action"
    ? validateLiveAction(config, presets)
    : validateAnimation(config, presets);
}

/** Every rule id the engine knows, for the runtime check that the UI can explain each one. */
export const ALL_RULE_IDS: readonly string[] = [
  ...LIVE_ACTION_RULES.map((r) => r.ruleId),
  ...ANIMATION_RULES.map((r) => r.ruleId),
];

// ---------------------------------------------------------------------------
// Applying a preset, validated
// ---------------------------------------------------------------------------

/**
 * Apply a preset and validate what came out, in one call.
 *
 * Lives here rather than in `presets.ts` because it needs both halves and
 * `rules.ts` is the one that already depends on the other — putting it the
 * other way round would make the two modules mutually recursive.
 *
 * Two things about the result are inherited from the original and are not
 * arbitrary:
 *
 *   1. **Rule messages come first, fallback warnings after.** The rules are
 *      talking about the shot; the fallbacks are talking about the preset
 *      file. A user reads the first group and acts on it; the second group is
 *      a note to whoever maintains the library.
 *   2. **A fallback alone downgrades `valid` to `warning`.** A preset that
 *      quietly lost its shot size produced a *valid* configuration that is not
 *      the film that was asked for, and reporting that as clean would hide the
 *      one thing worth knowing about it.
 *
 * This is also the honest answer to "is this card any good": `bicycle_thieves`
 * comes back `invalid`, because the preset pairs a heavy body with handheld
 * operation — which is a fact about the preset data, and now a visible one.
 */
export function applyPreset(
  preset: FilmPreset | AnimationPreset,
  vocabulary: Readonly<Record<string, readonly string[]>>,
  mappings: PresetMappings,
  presets: PresetIndex = PresetIndex.empty(),
): { config: CinemaConfig; validation: ValidationResult } {
  const applied = "year" in preset
    ? applyFilmPreset(preset, vocabulary, mappings)
    : applyAnimationPreset(preset, vocabulary, mappings);

  const base = validate(applied.config, presets);
  const messages = [...base.messages, ...applied.warnings];
  const hasHard = messages.some((m) => m.severity === "hard");
  const hasWarning = messages.some((m) => m.severity === "warning");

  return {
    config: applied.config,
    validation: {
      status: hasHard ? "invalid" : hasWarning ? "warning" : "valid",
      messages,
      autoCorrectionsApplied: applied.warnings.length > 0,
    },
  };
}
