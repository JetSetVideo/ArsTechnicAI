/**
 * prompt.ts — a configuration, rendered for one particular model.
 *
 * The config in `config.ts` is model-agnostic on purpose. This is where it
 * stops being agnostic: Midjourney wants comma-separated fragments and its own
 * flags; FLUX wants sentences and no negative prompt at all; CogVideoX has a
 * 224-token ceiling that a full specification blows straight through; Wan's
 * mixture-of-experts is measurably better when you *over*-specify. One string
 * for all of them is one string wrong for most of them.
 *
 * Ported from Director's Console's `cinema_rules/prompts/generator.py`,
 * formatting quirks included — the flag strings, the capitalisation, the
 * fifteen-part truncation — because those quirks are the accumulated result of
 * looking at output, not decisions to be tidied up on the way through.
 *
 * ## Two levels of detail
 *
 * `brief` is the working prompt: shot, camera, glass, light, mood. `detailed`
 * opens with the style reference and spells out the camera *system* — enough
 * that the sentence stands alone in a log without the config beside it. The
 * split exists because 80 words is roughly the point where an image model
 * stops gaining and a video model starts.
 *
 * [AGENT-VOCABULARY] Underscores become spaces on the way out, always: the
 * vocabulary is `Golden_Hour` because it is an identifier, and no prompt should
 * ever contain an identifier.
 */

import type { AnimationConfig, CinemaConfig, LiveActionConfig } from "./config.ts";
import type { PresetIndex } from "./presets.ts";

/**
 * The models the formatter knows by name.
 *
 * Anything else formats as `generic` — comma-separated, no flags — which is
 * the right fallback because it is what every model accepts. A new model is a
 * new case here, and until someone adds it the prompt is merely plain rather
 * than wrong.
 */
export type PromptTarget =
  | "generic"
  | "midjourney"
  | "flux"
  | "wan2.2"
  | "runway"
  | "pika"
  | "cogvideo"
  | "hunyuan"
  | "mochi"
  | "ltx"
  | "sdxl";

export const PROMPT_TARGETS: readonly PromptTarget[] = Object.freeze([
  "generic",
  "midjourney",
  "flux",
  "wan2.2",
  "runway",
  "pika",
  "cogvideo",
  "hunyuan",
  "mochi",
  "ltx",
  "sdxl",
]);

export type PromptDetail = "brief" | "detailed";

const spaced = (term: string): string => term.replaceAll("_", " ");

/** Python's `str.capitalize()`: first character up, **every other one down**. */
const capitalize = (text: string): string =>
  text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1).toLowerCase();

/**
 * Format a number the way Python prints a float.
 *
 * The squeeze ratio is the only number that reaches a prompt as a bare value,
 * and Python's `f"{2.0}"` is `"2.0"` where JavaScript's is `"2"`. The parity
 * test caught the difference; it is preserved rather than corrected because
 * "2.0x anamorphic" is also simply the more legible of the two.
 */
const pyFloat = (value: number): string => Number.isInteger(value) ? `${value}.0` : String(value);

// ---------------------------------------------------------------------------
// Assembling the parts
// ---------------------------------------------------------------------------

function liveActionParts(
  config: LiveActionConfig,
  presets: PresetIndex | null,
): string[] {
  const parts: string[] = [];

  parts.push(`${config.visualGrammar.shotSize} shot`);
  parts.push(`${spaced(config.visualGrammar.composition)} composition`);
  parts.push(`shot on ${config.camera.manufacturer} ${config.camera.body}`);

  if (config.camera.filmStock !== "None") {
    parts.push(`${spaced(config.camera.filmStock)} film stock`);
  }

  parts.push(`${config.lens.focalLengthMm}mm lens`);
  if (config.lens.isAnamorphic) parts.push("anamorphic");

  parts.push(`${config.camera.aspectRatio} aspect ratio`);

  parts.push(`${spaced(config.lighting.timeOfDay)} lighting`);
  parts.push(`${spaced(config.lighting.source)} light source`);
  parts.push(`${spaced(config.lighting.style)} lighting style`);

  if (config.movement.equipment !== "Static") {
    parts.push(`${spaced(config.movement.equipment)} camera`);
    if (config.movement.movementType !== "Static") {
      parts.push(`${spaced(config.movement.movementType)} movement`);
    }
  }

  parts.push(`${spaced(config.visualGrammar.mood)} mood`);
  parts.push(`${spaced(config.visualGrammar.colorTone)} color grade`);

  if (config.filmPreset !== undefined) {
    const preset = presets?.film(config.filmPreset) ?? null;
    if (preset) {
      parts.push(`in the style of ${preset.name}`);
      parts.push(`${preset.era} era cinematography`);
    } else {
      // Without the library loaded the id is still the best name available,
      // and a prompt that says "in the style of blade runner" is far better
      // than one that silently drops the reference the user chose.
      parts.push(`in the style of ${spaced(config.filmPreset)}`);
    }
  }

  return parts;
}

function liveActionPartsDetailed(
  config: LiveActionConfig,
  presets: PresetIndex | null,
): string[] {
  const parts: string[] = [];
  const preset = config.filmPreset !== undefined ? presets?.film(config.filmPreset) ?? null : null;

  if (preset) {
    parts.push(`Cinematic image in the visual style of ${preset.name} (${preset.year})`);
  }

  const cameraKind = config.camera.cameraType === "Film" ? "film camera" : "digital cinema camera";
  parts.push(`Shot on ${config.camera.manufacturer} ${config.camera.body} ${cameraKind}`);

  if (config.camera.filmStock !== "None") {
    parts.push(`using ${spaced(config.camera.filmStock)} film stock`);
  }

  let lens = `${config.lens.focalLengthMm}mm ${spaced(config.lens.family)} lens`;
  if (config.lens.isAnamorphic) {
    // `|| 2.0`, not `?? 2.0`: the original used Python's `or`, which also
    // replaces a squeeze of 0 — and a 0x squeeze is not a lens anyway.
    lens += ` (${pyFloat(config.lens.squeezeRatio || 2.0)}x anamorphic)`;
  }
  parts.push(lens);

  parts.push(`${config.camera.aspectRatio} aspect ratio`);
  parts.push(`${spaced(config.visualGrammar.shotSize)} shot`);
  parts.push(`${spaced(config.visualGrammar.composition)} composition`);

  parts.push(
    `${spaced(config.lighting.timeOfDay)} lighting, ` +
      `${spaced(config.lighting.source)} as key light, ` +
      `${spaced(config.lighting.style)} style`,
  );

  if (config.movement.equipment !== "Static") {
    let movement = `${spaced(config.movement.equipment)} camera`;
    if (config.movement.movementType !== "Static") {
      movement += ` with ${spaced(config.movement.movementType)} movement`;
    }
    if (config.movement.timing !== "Static") {
      movement += ` at ${spaced(config.movement.timing)} pace`;
    }
    parts.push(movement);
  } else {
    parts.push("static camera, locked-off frame");
  }

  parts.push(`${spaced(config.visualGrammar.mood)} mood and atmosphere`);
  parts.push(`${spaced(config.visualGrammar.colorTone)} color grading`);

  if (preset) {
    parts.push(`${preset.era} era cinematography aesthetic`);
  } else if (config.era !== undefined) {
    parts.push(`${config.era} era cinematography aesthetic`);
  }

  return parts;
}

function animationParts(config: AnimationConfig): string[] {
  const parts: string[] = [];

  parts.push(`${config.styleDomain} style`);
  parts.push(`${config.medium} animation`);

  parts.push(`${spaced(config.rendering.lineTreatment)} linework`);
  parts.push(`${spaced(config.rendering.colorApplication)} coloring`);
  parts.push(`${spaced(config.rendering.lightingModel)} lighting`);
  parts.push(`${spaced(config.rendering.surfaceDetail)} surfaces`);

  parts.push(`${config.visualGrammar.shotSize} shot`);
  parts.push(`${spaced(config.visualGrammar.composition)} composition`);

  if (config.motion.motionStyle !== "None") {
    parts.push(`${spaced(config.motion.motionStyle)} animation`);
    parts.push(`${spaced(config.motion.virtualCamera)} camera`);
  }

  parts.push(`${spaced(config.visualGrammar.mood)} mood`);
  parts.push(`${spaced(config.visualGrammar.colorTone)} color palette`);

  if (config.stylePreset !== undefined) {
    parts.push(`in the style of ${spaced(config.stylePreset)}`);
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Model-specific formatting
// ---------------------------------------------------------------------------

/**
 * Join the parts the way this particular model reads best.
 *
 * Each branch is an empirical finding rather than a preference, so each says
 * what it is compensating for. Changing one changes output quality, not style.
 */
export function formatForModel(parts: readonly string[], target: PromptTarget): string {
  switch (target) {
    case "midjourney":
      // Comma-separated fragments, plus the version and quality flags MJ needs
      // on the string itself — it has no other channel for them.
      return parts.join(", ") + " --v 6 --q 2";

    case "flux":
      // Natural language, sentence per clause. FLUX has no negative prompt, so
      // everything that matters has to be stated positively here.
      return parts.map(capitalize).join(". ") + ".";

    case "wan2.2":
      // 80–120 words. The mixture-of-experts routing rewards over-specification,
      // so a short prompt is padded rather than left thin.
      return parts.map(capitalize).join(". ") +
        ". Cinematic quality, professional lighting, highly detailed.";

    case "runway":
    case "pika":
    case "ltx":
      // Descriptive natural language, lower case throughout.
      return parts.map((p) => p.toLowerCase()).join(" ");

    case "cogvideo":
      // A hard 224-token ceiling. Truncating at fifteen parts keeps the camera,
      // lens and light — the front of the list — and drops the grading notes,
      // which is the right thing to lose.
      return parts.slice(0, 15).join(", ");

    case "hunyuan":
      // Has its own prompt rewriter, so detail survives the round trip.
      return parts.map(capitalize).join(". ") + ".";

    case "mochi":
    case "sdxl":
      // Weighted comma-separated tokens.
      return parts.join(", ");

    case "generic":
    default:
      return parts.join(", ");
  }
}

/**
 * The negative prompt, where the model has one.
 *
 * FLUX and Wan take none — passing one to them is at best ignored and at worst
 * concatenated into the positive prompt by a careless wrapper, which is how
 * "blurry, low quality" ends up *in* an image.
 */
export function negativePrompt(target: PromptTarget): string | null {
  if (target === "flux" || target === "wan2.2") return null;
  return "blurry, low quality, distorted, deformed, ugly, bad anatomy, " +
    "watermark, signature, text, logo, amateur, poorly lit";
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface RenderedPrompt {
  readonly positive: string;
  readonly negative: string | null;
  /** The parts before joining, so a UI can show what contributed what. */
  readonly parts: readonly string[];
  readonly target: PromptTarget;
}

/**
 * Render a configuration for a model.
 *
 * `presets` is optional: without it a film reference degrades to its id rather
 * than failing, which keeps prompt rendering usable before the library has
 * loaded — the canvas draws cards well before `/api/library` answers.
 */
export function renderPrompt(
  config: CinemaConfig,
  target: PromptTarget = "generic",
  options: { detail?: PromptDetail; presets?: PresetIndex } = {},
): RenderedPrompt {
  const detail = options.detail ?? "brief";
  const presets = options.presets ?? null;

  const parts = config.mode === "live_action"
    ? (detail === "detailed"
      ? liveActionPartsDetailed(config, presets)
      : liveActionParts(config, presets))
    : animationParts(config);

  return {
    positive: formatForModel(parts, target),
    negative: negativePrompt(target),
    parts,
    target,
  };
}
