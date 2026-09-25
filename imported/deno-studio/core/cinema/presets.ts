/**
 * presets.ts — the films and the styles, as data the canvas can hold.
 *
 * 67 live-action pictures from *Metropolis* (1927) to *Parasite* (2019), and
 * 43 animation styles from Ghibli to Spider-Verse. Each one records what was
 * actually used: the body, the glass, the stock, the aspect ratio, the
 * instruments on the floor, the moods the picture will and will not carry.
 *
 * ## Why a preset is not a prompt
 *
 * "In the style of Blade Runner" is a wish. *This* is a specification: a
 * Panavision Panaflex on Eastman 5293, C-Series anamorphics at 35/50/75/100,
 * lit by neon, tungsten and practicals, low-key and hard, 2.39:1, and —
 * critically — **not** cheerful, hopeful or whimsical. Applying it produces a
 * `CinemaConfig` that the rules in `rules.ts` then have something to say
 * about, rather than a string the model has to guess at.
 *
 * ## Why the data is loaded rather than compiled in
 *
 * `core/` is the pure layer: no disk, no network, no `Deno` global, so it runs
 * unchanged in the browser bundle and in a test. A `PresetIndex` is therefore
 * *constructed from* parsed JSON that someone else read — the server from
 * `library/cinema/`, the browser from `/api/library`. That is also what makes
 * the library extensible: adding a film is adding a JSON entry, not a rebuild.
 *
 * [AGENT-VOCABULARY] Field names here are the library's own snake_case,
 * because the JSON is the wire format and renaming on the way in would mean
 * every future hand-written entry has to know about the rename. The typed
 * `CinemaConfig` in `config.ts` is camelCase; `applyFilmPreset` is the seam.
 */

import type {
  AnimationConfig,
  CinemaConfig,
  LiveActionConfig,
  ValidationMessage,
} from "./config.ts";
import { DEFAULT_ANIMATION, DEFAULT_LIVE_ACTION } from "./config.ts";

// ---------------------------------------------------------------------------
// Wire shapes
// ---------------------------------------------------------------------------

/**
 * One film, as `library/cinema/live-action.json` holds it.
 *
 * Nearly every field is a *list*, because a picture is not one lens and one
 * mood — *Blade Runner* used four focal lengths and three light sources. The
 * lists are the picture's palette; applying a preset takes the first of each
 * as a starting point and leaves the rest available.
 */
export interface FilmPreset {
  readonly id: string;
  readonly name: string;
  readonly year: number;
  readonly era: string;
  readonly mood: readonly string[];
  readonly color_tone: readonly string[];
  readonly lighting_style: readonly string[];
  readonly lighting_sources: readonly string[];
  readonly composition: readonly string[];
  readonly shot_sizes: readonly string[];
  readonly movement: readonly string[];
  readonly camera_type: string;
  readonly camera_body: readonly string[];
  readonly film_stock: readonly string[];
  readonly aspect_ratio: string | null;
  readonly lens_manufacturer: readonly string[];
  readonly lens_family: readonly string[];
  readonly primary_focal_lengths: readonly number[];
  /** Moods this picture will not carry. The reason the preset can *refuse*. */
  readonly disallowed_moods: readonly string[];
  /** Instruments unavailable to it — usually because they did not exist yet. */
  readonly disallowed_sources: readonly string[];
  /** Home overlay facts — optional, additive, never required to apply the preset. */
  readonly where?: string;
  readonly why?: string;
  readonly how?: string;
  readonly studio?: string;
  readonly length?: string | number;
  readonly characters?: readonly string[];
  readonly actors?: readonly string[];
  readonly score?: number;
  readonly related?: readonly string[];
}

export interface AnimationPreset {
  readonly id: string;
  readonly name: string;
  readonly domain: string;
  readonly medium: string;
  readonly line_treatment: string;
  readonly color_application: string;
  readonly lighting_model: string;
  readonly surface_detail: string;
  readonly motion_style: string;
  readonly virtual_camera: string;
  readonly mood: readonly string[];
  readonly color_tone: readonly string[];
  readonly composition: readonly string[];
  readonly reference_works: readonly string[];
  readonly disallowed_cameras: readonly string[];
  readonly disallowed_motion: readonly string[];
  /** Home overlay facts — optional, additive. */
  readonly where?: string;
  readonly why?: string;
  readonly how?: string;
  readonly studio?: string;
  readonly length?: string | number;
  readonly characters?: readonly string[];
  readonly actors?: readonly string[];
  readonly score?: number;
  readonly related?: readonly string[];
}

/**
 * The prose half: who shot it, and how they talk about it.
 *
 * Kept separate from `FilmPreset` because the two answer different questions.
 * `FilmPreset` is machine-readable constraint; this is what a prompt actually
 * wants to *say* — "hard top-light through venetian blinds", "bleach bypass" —
 * and it is the part `prompt.ts` renders into the string.
 */
export interface CinematographyStyle {
  readonly preset_id: string;
  readonly cinematographer: string;
  readonly camera: string;
  readonly film_stock: string;
  readonly aspect_ratio: string;
  readonly lighting_signature: string;
  readonly color_palette: string;
  readonly notable_techniques: string;
  readonly lens_info: string;
  readonly movement_style: string;
  readonly legacy: string | null;
}

export interface CinemaLibraryData {
  readonly liveAction: Readonly<Record<string, FilmPreset>>;
  readonly animation: Readonly<Record<string, AnimationPreset>>;
  readonly cinematography: Readonly<Record<string, CinematographyStyle>>;
}

// ---------------------------------------------------------------------------
// The index
// ---------------------------------------------------------------------------

/**
 * Presets, indexed and immutable.
 *
 * Frozen at construction for the same reason `NodeRegistry` is: a preset that
 * could change underneath a graph would make an already-validated config's
 * validity time-dependent.
 */
export class PresetIndex {
  readonly #films: ReadonlyMap<string, FilmPreset>;
  readonly #styles: ReadonlyMap<string, AnimationPreset>;
  readonly #cinematography: ReadonlyMap<string, CinematographyStyle>;

  constructor(data: CinemaLibraryData) {
    this.#films = new Map(Object.entries(data.liveAction));
    this.#styles = new Map(Object.entries(data.animation));
    this.#cinematography = new Map(Object.entries(data.cinematography));
  }

  /** An index over nothing — the state before the library has loaded. */
  static empty(): PresetIndex {
    return new PresetIndex({ liveAction: {}, animation: {}, cinematography: {} });
  }

  film(id: string): FilmPreset | null {
    return this.#films.get(id) ?? null;
  }

  style(id: string): AnimationPreset | null {
    return this.#styles.get(id) ?? null;
  }

  cinematography(presetId: string): CinematographyStyle | null {
    return this.#cinematography.get(presetId) ?? null;
  }

  films(): readonly FilmPreset[] {
    return [...this.#films.values()];
  }

  styles(): readonly AnimationPreset[] {
    return [...this.#styles.values()];
  }

  get size(): number {
    return this.#films.size + this.#styles.size;
  }
}

// ---------------------------------------------------------------------------
// Preset constraints
// ---------------------------------------------------------------------------

/**
 * What a preset refuses.
 *
 * A film preset carries an explicit veto list — *Blade Runner* does not do
 * cheerful — and the vetoes are `hard`, not warnings, because the user asked
 * for that picture's grammar and this is the grammar saying no. Ported from
 * `RuleEngine._validate_live_action_preset`, message text included: the
 * strings name the preset and list the alternatives, which is what makes the
 * refusal actionable rather than merely negative.
 */
export function presetConstraints(
  config: CinemaConfig,
  presets: PresetIndex,
): readonly ValidationMessage[] {
  return config.mode === "live_action"
    ? filmConstraints(config, presets)
    : styleConstraints(config, presets);
}

function filmConstraints(
  config: LiveActionConfig,
  presets: PresetIndex,
): readonly ValidationMessage[] {
  if (config.filmPreset === undefined) return [];
  const preset = presets.film(config.filmPreset);
  // An unknown id constrains nothing. The library is user-extensible, so a
  // graph saved against a preset that has since been removed must still open.
  if (!preset) return [];

  const messages: ValidationMessage[] = [];
  const mood = config.visualGrammar.mood;
  if (preset.disallowed_moods.includes(mood)) {
    messages.push({
      ruleId: "PRESET_DISALLOWED_MOOD",
      severity: "hard",
      message: `'${mood}' mood is incompatible with ${preset.name} style. ` +
        `Disallowed moods: ${preset.disallowed_moods.join(", ")}`,
      fieldPath: "visual_grammar.mood",
    });
  }

  const source = config.lighting.source;
  if (preset.disallowed_sources.includes(source)) {
    messages.push({
      ruleId: "PRESET_DISALLOWED_SOURCE",
      severity: "hard",
      message: `'${source}' lighting source is incompatible with ${preset.name} ` +
        `(${preset.year}). Disallowed sources: ${preset.disallowed_sources.join(", ")}`,
      fieldPath: "lighting.source",
    });
  }

  return messages;
}

function styleConstraints(
  config: AnimationConfig,
  presets: PresetIndex,
): readonly ValidationMessage[] {
  if (config.stylePreset === undefined) return [];
  const preset = presets.style(config.stylePreset);
  if (!preset) return [];

  const messages: ValidationMessage[] = [];
  const camera = config.motion.virtualCamera;
  if (preset.disallowed_cameras.includes(camera)) {
    messages.push({
      ruleId: "PRESET_DISALLOWED_CAMERA",
      severity: "hard",
      message: `'${camera}' virtual camera is incompatible with ${preset.name} style. ` +
        `Disallowed: ${preset.disallowed_cameras.join(", ")}`,
      fieldPath: "motion.virtual_camera",
    });
  }

  const motion = config.motion.motionStyle;
  if (preset.disallowed_motion.includes(motion)) {
    messages.push({
      ruleId: "PRESET_DISALLOWED_MOTION",
      severity: "hard",
      message: `'${motion}' motion style is incompatible with ${preset.name} style. ` +
        `Disallowed: ${preset.disallowed_motion.join(", ")}`,
      fieldPath: "motion.motion_style",
    });
  }

  return messages;
}

// ---------------------------------------------------------------------------
// Applying a preset
// ---------------------------------------------------------------------------

/**
 * The lookup tables applying a preset needs.
 *
 * Passed in rather than imported so a test can supply a deliberately
 * impoverished table and check that the fallback path actually fires — which a
 * module reaching for its own constants cannot be made to do.
 * `bridge/library.ts` assembles the real ones from `gen/`.
 */
export interface PresetMappings {
  readonly cameraManufacturerByBody: Readonly<Record<string, string>>;
  readonly lensManufacturerAliases: Readonly<Record<string, string>>;
  readonly lensFamilyAliases: Readonly<Record<string, string>>;
  readonly movementAliases: Readonly<
    Record<
      string,
      { readonly field: "equipment" | "movementType" | "timing"; readonly value: string }
    >
  >;
  readonly shotSizeAliases: Readonly<Record<string, string>>;
  readonly compositionAliases: Readonly<Record<string, string>>;
  readonly colorToneAliases: Readonly<Record<string, string>>;
  readonly styleDomainAliases: Readonly<Record<string, string>>;
  readonly animationMediumAliases: Readonly<Record<string, string>>;
  /** Membership tests the Panavision reconciliation needs. */
  readonly panavisionBodies: readonly string[];
  readonly panavisionLenses: readonly string[];
}

/**
 * Resolve one hand-written preset term against a closed vocabulary.
 *
 * Presets were written by people describing films, so they say `Wide_Shot`,
 * `Slow_Dolly`, `Muted` and `Teal Orange`. The vocabulary says `WS`, `Dolly`,
 * `Neutral_Desaturated` and `Teal_Orange`. Three things can happen, and the
 * difference between them is the whole reason this is not a cast:
 *
 *   1. the term *is* a vocabulary value — take it;
 *   2. an alias table knows it — take what the alias names;
 *   3. nobody knows it — keep the default **and say so**.
 *
 * Case 3 is why this returns a warning rather than failing quietly. A preset
 * whose shot size does not resolve produces a config that looks fine and is
 * simply not the film the user asked for; the `PRESET_FALLBACK_*` message is
 * the only evidence that happened. Ported from `RuleEngine`'s `get_*` helpers,
 * message text included.
 */
function resolveTerm<T extends string>(
  value: string,
  vocabulary: readonly string[],
  aliases: Readonly<Record<string, string>>,
  fallback: T,
  warning: { ruleId: string; fieldPath: string; label: string; presetId: string },
  warnings: ValidationMessage[],
): T {
  if (vocabulary.includes(value)) return value as T;
  const aliased = aliases[value];
  if (aliased !== undefined && vocabulary.includes(aliased)) return aliased as T;
  warnings.push({
    ruleId: warning.ruleId,
    severity: "warning",
    message: `Unknown ${warning.label} '${value}' in preset '${warning.presetId}'. Using default.`,
    fieldPath: warning.fieldPath,
  });
  return fallback;
}

export interface AppliedPreset<C extends CinemaConfig> {
  readonly config: C;
  /**
   * Every term the preset used that the vocabulary could not resolve.
   *
   * Surfaced on the card rather than swallowed: a movie reference that lost
   * three of its fields is still worth using, and the user should be able to
   * see which three.
   */
  readonly warnings: readonly ValidationMessage[];
}

/**
 * Seed a live-action config from a film.
 *
 * The result is a *starting point*, not a lock: the user is expected to move
 * the focal length and re-frame. What the preset fixes is the part that would
 * otherwise be guesswork — the body, the stock, the mount, and the era that
 * makes the anachronism rules decidable at all.
 */
export function applyFilmPreset(
  preset: FilmPreset,
  vocab: Readonly<Record<string, readonly string[]>>,
  mappings: PresetMappings,
): AppliedPreset<LiveActionConfig> {
  const base = DEFAULT_LIVE_ACTION;
  const warnings: ValidationMessage[] = [];
  const id = preset.id;
  const V = (name: string): readonly string[] => vocab[name] ?? [];
  const NONE: Readonly<Record<string, string>> = {};

  const cameraType = preset.camera_type === "Film" ? "Film" : "Digital";

  // Each of these scans the preset's *whole* list for the first term the
  // vocabulary knows, rather than taking `[0]` and giving up. Several presets
  // lead with a body or stock that was never added to the vocabulary and name a
  // known one second; taking the head would silently drop the film's camera.
  let body = base.camera.body;
  for (const candidate of preset.camera_body) {
    if (V("CameraBody").includes(candidate)) {
      body = candidate as LiveActionConfig["camera"]["body"];
      break;
    }
  }

  // The body carries the manufacturer; the preset does not name one. Falling
  // back to the config default would print "ARRI Panavision_Panaflex".
  const manufacturer = (mappings.cameraManufacturerByBody[body] ??
    (cameraType === "Film" ? "ARRI_Film" : "ARRI")) as LiveActionConfig["camera"]["manufacturer"];

  let filmStock: LiveActionConfig["camera"]["filmStock"] = "None";
  if (cameraType === "Film") {
    for (const candidate of preset.film_stock) {
      if (V("FilmStock").includes(candidate)) {
        filmStock = candidate as LiveActionConfig["camera"]["filmStock"];
        break;
      }
    }
    // Then a substring pass, which is how presets naming "Eastman 5254" find
    // `Eastman_5254`. Loose, and deliberately so: a stock the vocabulary almost
    // knows is worth resolving, and the alternative is an unstocked film camera
    // — which `LA_FILM_REQUIRES_STOCK` reports as a hard error.
    if (filmStock === "None" && preset.film_stock[0] !== undefined) {
      const needle = preset.film_stock[0].toLowerCase().replaceAll(" ", "_");
      for (const candidate of V("FilmStock")) {
        if (candidate.toLowerCase().includes(needle)) {
          filmStock = candidate as LiveActionConfig["camera"]["filmStock"];
          break;
        }
      }
    }
  }

  // 1.85:1, not the config's own 2.39:1 — a preset with an aspect ratio the
  // vocabulary lacks (1.19:1, 1.66:1 Academy variants) is far more likely to
  // have been flat than scope.
  const aspectRatio = (preset.aspect_ratio !== null &&
      V("AspectRatio").includes(preset.aspect_ratio)
    ? preset.aspect_ratio
    : "1.85:1") as LiveActionConfig["camera"]["aspectRatio"];

  // Lens manufacturer: first match wins, and anything containing "panavision"
  // is Panavision regardless of how the preset spelled it.
  let lensManufacturer = base.lens.manufacturer;
  for (const candidate of preset.lens_manufacturer) {
    if (V("LensManufacturer").includes(candidate)) {
      lensManufacturer = candidate as LiveActionConfig["lens"]["manufacturer"];
      break;
    }
    const alias = mappings.lensManufacturerAliases[candidate];
    if (alias !== undefined) {
      lensManufacturer = alias as LiveActionConfig["lens"]["manufacturer"];
      break;
    }
    if (candidate.toLowerCase().includes("panavision")) {
      lensManufacturer = "Panavision" as LiveActionConfig["lens"]["manufacturer"];
      break;
    }
  }

  let lensFamily = base.lens.family;
  for (const candidate of preset.lens_family) {
    if (V("LensFamily").includes(candidate)) {
      lensFamily = candidate as LiveActionConfig["lens"]["family"];
      break;
    }
    const alias = mappings.lensFamilyAliases[candidate];
    if (alias !== undefined) {
      lensFamily = alias as LiveActionConfig["lens"]["family"];
      break;
    }
  }

  // A Panavision body with non-Panavision glass would trip the closed-ecosystem
  // rule the moment the card was dropped, so the preset resolves it here rather
  // than handing the user a configuration that is invalid on arrival.
  if (
    mappings.panavisionBodies.includes(body) && !mappings.panavisionLenses.includes(lensFamily)
  ) {
    lensFamily = "Panavision_Primo" as LiveActionConfig["lens"]["family"];
    lensManufacturer = "Panavision" as LiveActionConfig["lens"]["manufacturer"];
  }

  // Movement: one string that may name equipment, a movement or a timing.
  let equipment = base.movement.equipment;
  let movementType = base.movement.movementType;
  let timing = base.movement.timing;
  const movementValue = preset.movement[0];
  if (movementValue !== undefined) {
    if (V("MovementEquipment").includes(movementValue)) {
      equipment = movementValue as LiveActionConfig["movement"]["equipment"];
    } else if (V("MovementType").includes(movementValue)) {
      movementType = movementValue as LiveActionConfig["movement"]["movementType"];
    } else if (V("MovementTiming").includes(movementValue)) {
      timing = movementValue as LiveActionConfig["movement"]["timing"];
    } else {
      const alias = mappings.movementAliases[movementValue];
      if (alias) {
        if (alias.field === "equipment") {
          equipment = alias.value as LiveActionConfig["movement"]["equipment"];
        } else if (alias.field === "movementType") {
          movementType = alias.value as LiveActionConfig["movement"]["movementType"];
        } else {
          timing = alias.value as LiveActionConfig["movement"]["timing"];
        }
      } else {
        warnings.push({
          ruleId: "PRESET_FALLBACK_MOVEMENT",
          severity: "warning",
          message: `Unknown movement '${movementValue}' in preset '${id}'. Using default.`,
          fieldPath: "movement",
        });
      }
    }
  }

  let lightingStyle = base.lighting.style;
  const styleValue = preset.lighting_style[0];
  if (styleValue !== undefined) {
    if (V("LightingStyle").includes(styleValue)) {
      lightingStyle = styleValue as LiveActionConfig["lighting"]["style"];
    } else {
      warnings.push({
        ruleId: "PRESET_FALLBACK_LIGHTING_STYLE",
        severity: "warning",
        message: `Unknown lighting style '${styleValue}' in preset '${id}'. Using default.`,
        fieldPath: "lighting.style",
      });
    }
  }

  let lightingSource = base.lighting.source;
  const sourceValue = preset.lighting_sources[0];
  if (sourceValue !== undefined) {
    if (V("LightingSource").includes(sourceValue)) {
      lightingSource = sourceValue as LiveActionConfig["lighting"]["source"];
    } else {
      warnings.push({
        ruleId: "PRESET_FALLBACK_LIGHTING_SOURCE",
        severity: "warning",
        message: `Unknown lighting source '${sourceValue}' in preset '${id}'. Using default.`,
        fieldPath: "lighting.source",
      });
    }
  }

  const shotSize = preset.shot_sizes[0] === undefined ? base.visualGrammar.shotSize : resolveTerm(
    preset.shot_sizes[0],
    V("ShotSize"),
    mappings.shotSizeAliases,
    base.visualGrammar.shotSize,
    {
      ruleId: "PRESET_FALLBACK_SHOT_SIZE",
      fieldPath: "visual_grammar.shot_size",
      label: "shot size",
      presetId: id,
    },
    warnings,
  );

  const composition = preset.composition[0] === undefined
    ? base.visualGrammar.composition
    : resolveTerm(
      preset.composition[0],
      V("Composition"),
      mappings.compositionAliases,
      base.visualGrammar.composition,
      {
        ruleId: "PRESET_FALLBACK_COMPOSITION",
        fieldPath: "visual_grammar.composition",
        label: "composition",
        presetId: id,
      },
      warnings,
    );

  const mood = preset.mood[0] === undefined ? base.visualGrammar.mood : resolveTerm(
    preset.mood[0],
    V("Mood"),
    NONE,
    base.visualGrammar.mood,
    {
      ruleId: "PRESET_FALLBACK_MOOD",
      fieldPath: "visual_grammar.mood",
      label: "mood",
      presetId: id,
    },
    warnings,
  );

  const colorTone = preset.color_tone[0] === undefined ? base.visualGrammar.colorTone : resolveTerm(
    preset.color_tone[0],
    V("ColorTone"),
    mappings.colorToneAliases,
    base.visualGrammar.colorTone,
    {
      ruleId: "PRESET_FALLBACK_COLOR_TONE",
      fieldPath: "visual_grammar.color_tone",
      label: "color tone",
      presetId: id,
    },
    warnings,
  );

  const config: LiveActionConfig = {
    mode: "live_action",
    camera: {
      cameraType: cameraType as LiveActionConfig["camera"]["cameraType"],
      manufacturer,
      body,
      sensor: base.camera.sensor,
      weightClass: base.camera.weightClass,
      filmStock,
      aspectRatio,
    },
    lens: {
      manufacturer: lensManufacturer,
      family: lensFamily,
      focalLengthMm: preset.primary_focal_lengths[0] ?? 35,
      // Faithful to the original, which never derives this from the family and
      // so leaves `Vintage_Anamorphic` marked spherical. `withAnamorphicFlag`
      // corrects it as an explicit, separately tested step rather than smuggling
      // a judgement into a function whose contract is parity.
      isAnamorphic: false,
    },
    movement: { equipment, movementType, timing },
    lighting: { timeOfDay: base.lighting.timeOfDay, source: lightingSource, style: lightingStyle },
    visualGrammar: { shotSize, composition, mood, colorTone },
    filmPreset: id,
    era: preset.era,
  };

  return { config, warnings };
}

/**
 * Seed an animation config from a style.
 *
 * Two asymmetries with the live-action path are inherited from the original
 * and are worth naming, because both look like oversights and only one is:
 *
 *   - `medium` and `styleDomain` fall back **silently**. They have their own
 *     alias tables (`3D` for `ThreeD`), and a domain outside the table is far
 *     more likely to be a new style someone is drafting than a typo.
 *   - Shot size is always `MS`. `AnimationPreset` has no `shot_sizes` field at
 *     all — a drawing style does not imply a framing the way a film's coverage
 *     does — so there is nothing to resolve and nothing to warn about.
 */
export function applyAnimationPreset(
  preset: AnimationPreset,
  vocab: Readonly<Record<string, readonly string[]>>,
  mappings: PresetMappings,
): AppliedPreset<AnimationConfig> {
  const base = DEFAULT_ANIMATION;
  const warnings: ValidationMessage[] = [];
  const id = preset.id;
  const V = (name: string): readonly string[] => vocab[name] ?? [];
  const NONE: Readonly<Record<string, string>> = {};

  /** Warn-on-miss, keep the default. Used for every rendering and motion field. */
  const strict = <T extends string>(
    value: string,
    vocabulary: string,
    fallback: T,
    ruleId: string,
    fieldPath: string,
    label: string,
  ): T => {
    if (value === "") return fallback;
    if (V(vocabulary).includes(value)) return value as T;
    warnings.push({
      ruleId,
      severity: "warning",
      message: `Unknown ${label} '${value}' in preset '${id}'. Using default.`,
      fieldPath,
    });
    return fallback;
  };

  const config: AnimationConfig = {
    mode: "animation",
    medium: (mappings.animationMediumAliases[preset.medium] ??
      base.medium) as AnimationConfig["medium"],
    styleDomain: (mappings.styleDomainAliases[preset.domain] ??
      base.styleDomain) as AnimationConfig["styleDomain"],
    rendering: {
      lineTreatment: strict(
        preset.line_treatment,
        "LineTreatment",
        base.rendering.lineTreatment,
        "PRESET_FALLBACK_ANIMATION_LINE_TREATMENT",
        "rendering.line_treatment",
        "line treatment",
      ),
      colorApplication: strict(
        preset.color_application,
        "ColorApplication",
        base.rendering.colorApplication,
        "PRESET_FALLBACK_ANIMATION_COLOR_APPLICATION",
        "rendering.color_application",
        "color application",
      ),
      lightingModel: strict(
        preset.lighting_model,
        "LightingModel",
        base.rendering.lightingModel,
        "PRESET_FALLBACK_ANIMATION_LIGHTING_MODEL",
        "rendering.lighting_model",
        "lighting model",
      ),
      surfaceDetail: strict(
        preset.surface_detail,
        "SurfaceDetail",
        base.rendering.surfaceDetail,
        "PRESET_FALLBACK_ANIMATION_SURFACE_DETAIL",
        "rendering.surface_detail",
        "surface detail",
      ),
    },
    motion: {
      motionStyle: strict(
        preset.motion_style,
        "MotionStyle",
        base.motion.motionStyle,
        "PRESET_FALLBACK_ANIMATION_MOTION_STYLE",
        "motion.motion_style",
        "motion style",
      ),
      virtualCamera: strict(
        preset.virtual_camera,
        "VirtualCamera",
        base.motion.virtualCamera,
        "PRESET_FALLBACK_ANIMATION_VIRTUAL_CAMERA",
        "motion.virtual_camera",
        "virtual camera",
      ),
    },
    visualGrammar: {
      // No `shot_sizes` on an animation preset; MS is the standing default.
      shotSize: base.visualGrammar.shotSize,
      // Note these take NO alias table, unlike the live-action path — the
      // original's animation branch builds plain enum maps. Passing the
      // aliases here would resolve terms the reference engine rejects.
      composition: preset.composition[0] === undefined
        ? base.visualGrammar.composition
        : resolveTerm(
          preset.composition[0],
          V("Composition"),
          NONE,
          base.visualGrammar.composition,
          {
            ruleId: "PRESET_FALLBACK_ANIMATION_COMPOSITION",
            fieldPath: "visual_grammar.composition",
            label: "composition",
            presetId: id,
          },
          warnings,
        ),
      mood: preset.mood[0] === undefined ? base.visualGrammar.mood : resolveTerm(
        preset.mood[0],
        V("Mood"),
        NONE,
        base.visualGrammar.mood,
        {
          ruleId: "PRESET_FALLBACK_ANIMATION_MOOD",
          fieldPath: "visual_grammar.mood",
          label: "mood",
          presetId: id,
        },
        warnings,
      ),
      colorTone: preset.color_tone[0] === undefined ? base.visualGrammar.colorTone : resolveTerm(
        preset.color_tone[0],
        V("ColorTone"),
        NONE,
        base.visualGrammar.colorTone,
        {
          ruleId: "PRESET_FALLBACK_ANIMATION_COLOR_TONE",
          fieldPath: "visual_grammar.color_tone",
          label: "color tone",
          presetId: id,
        },
        warnings,
      ),
    },
    stylePreset: id,
  };

  return { config, warnings };
}

/**
 * Set `isAnamorphic` from the lens family.
 *
 * `applyFilmPreset` reproduces the original exactly, and the original never
 * looks at the family when deciding whether the glass is anamorphic — so eight
 * presets that specify `Vintage_Anamorphic` or `Panavision_Anamorphic` come
 * back marked spherical. The consequences are small but real: the prompt omits
 * the word "anamorphic", and `LA_ANAMORPHIC_INFO` never reminds anyone to
 * de-squeeze.
 *
 * Correcting it inside `applyFilmPreset` would make the parity test fail, and a
 * parity test that has been relaxed to accommodate an improvement no longer
 * verifies anything. So the correction is a separate, named step that the
 * library applies to the cards it builds, and `presets_test.ts` pins it.
 */
export function withAnamorphicFlag(config: LiveActionConfig): LiveActionConfig {
  const anamorphic = config.lens.family.toLowerCase().includes("anamorphic");
  if (anamorphic === config.lens.isAnamorphic) return config;
  return { ...config, lens: { ...config.lens, isAnamorphic: anamorphic } };
}
