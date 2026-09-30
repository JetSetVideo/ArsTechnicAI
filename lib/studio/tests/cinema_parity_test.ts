/**
 * cinema_parity_test.ts — the port is only a port if it answers the same.
 *
 * `core/cinema/rules.ts` is a hand-written translation of ~2 000 lines of
 * Python predicates. Reviewing a translation that size by reading it is not a
 * check; it is a hope. So this drives *both* engines over the same generated
 * configurations and fails on any difference in the messages they return —
 * rule id, severity, text, field path and order.
 *
 * ## What is generated, and why not randomly
 *
 * The configurations come from a fixed LCG seed, so a failure names a
 * reproducible case rather than "sometimes". Two families are generated:
 *
 *   1. **Broad** — every field drawn uniformly from its whole vocabulary.
 *      Most of these are absurd shots, which is the point: the rules are
 *      mostly about absurd shots.
 *   2. **Targeted** — one case built to trip each rule individually, because
 *      uniform sampling almost never lands on `Ultra_Panavision_70` *and*
 *      2.76:1 at once, and a rule never exercised is a rule never compared.
 *
 * ## Skipping
 *
 * This needs the original checkout and its interpreter. When they are absent
 * the test warns and returns rather than failing — the same policy as
 * `contract_test.ts`. The port is meant to outlive the Python, and a suite
 * that goes red the day the donor is deleted would be deleted with it.
 */

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  ANIMATION_RULES,
  LIVE_ACTION_RULES,
  validateAnimation,
  validateLiveAction,
} from "../core/cinema/rules.ts";
import { CINEMA_VOCABULARIES } from "../gen/cinema_vocabulary.ts";
import { negativePrompt, PROMPT_TARGETS, renderPrompt } from "../core/cinema/prompt.ts";
import type {
  AnimationConfig,
  LiveActionConfig,
  ValidationMessage,
} from "../core/cinema/config.ts";
import { DEFAULT_ANIMATION, DEFAULT_LIVE_ACTION } from "../core/cinema/config.ts";

const CPE_ROOT = Deno.env.get("CPE_ROOT") ??
  new URL("../../DirectorsConsole/CinemaPromptEngineering", import.meta.url).pathname;
const REFERENCE = new URL("./parity/cpe_reference.py", import.meta.url).pathname;

// ---------------------------------------------------------------------------
// Deterministic sampling
// ---------------------------------------------------------------------------

/**
 * A 32-bit LCG. Not a good generator; a *reproducible* one, which is the only
 * property that matters when the output is a test corpus.
 */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length)] as T;
}

const vocab = (name: string): readonly string[] => {
  const values = CINEMA_VOCABULARIES[name];
  assert(values !== undefined && values.length > 0, `vocabulary ${name} is missing or empty`);
  return values;
};

function randomLiveAction(rng: () => number): LiveActionConfig {
  return {
    mode: "live_action",
    camera: {
      cameraType: pick(rng, vocab("CameraType")),
      manufacturer: pick(rng, vocab("CameraManufacturer")),
      body: pick(rng, vocab("CameraBody")),
      sensor: pick(rng, vocab("SensorSize")),
      weightClass: pick(rng, vocab("WeightClass")),
      filmStock: pick(rng, vocab("FilmStock")),
      aspectRatio: pick(rng, vocab("AspectRatio")),
    } as LiveActionConfig["camera"],
    lens: {
      manufacturer: pick(rng, vocab("LensManufacturer")),
      family: pick(rng, vocab("LensFamily")),
      focalLengthMm: 8 + Math.floor(rng() * 200),
      isAnamorphic: rng() < 0.3,
    } as LiveActionConfig["lens"],
    movement: {
      equipment: pick(rng, vocab("MovementEquipment")),
      movementType: pick(rng, vocab("MovementType")),
      timing: pick(rng, vocab("MovementTiming")),
    } as LiveActionConfig["movement"],
    lighting: {
      timeOfDay: pick(rng, vocab("TimeOfDay")),
      source: pick(rng, vocab("LightingSource")),
      style: pick(rng, vocab("LightingStyle")),
    } as LiveActionConfig["lighting"],
    visualGrammar: {
      shotSize: pick(rng, vocab("ShotSize")),
      composition: pick(rng, vocab("Composition")),
      mood: pick(rng, vocab("Mood")),
      colorTone: pick(rng, vocab("ColorTone")),
    } as LiveActionConfig["visualGrammar"],
    // Eras exercise the anachronism rules, including the shapes the matcher is
    // meant to *not* recognise.
    era: pick(rng, [
      "1920s",
      "1940s",
      "1970s",
      "1980s",
      "2010s",
      "Silent Era",
      "modern",
      "unknown",
    ]),
  };
}

function randomAnimation(rng: () => number): AnimationConfig {
  return {
    mode: "animation",
    medium: pick(rng, vocab("AnimationMedium")) as AnimationConfig["medium"],
    styleDomain: pick(rng, vocab("StyleDomain")) as AnimationConfig["styleDomain"],
    rendering: {
      lineTreatment: pick(rng, vocab("LineTreatment")),
      colorApplication: pick(rng, vocab("ColorApplication")),
      lightingModel: pick(rng, vocab("LightingModel")),
      surfaceDetail: pick(rng, vocab("SurfaceDetail")),
    } as AnimationConfig["rendering"],
    motion: {
      motionStyle: pick(rng, vocab("MotionStyle")),
      virtualCamera: pick(rng, vocab("VirtualCamera")),
    } as AnimationConfig["motion"],
    visualGrammar: {
      shotSize: pick(rng, vocab("ShotSize")),
      composition: pick(rng, vocab("Composition")),
      mood: pick(rng, vocab("Mood")),
      colorTone: pick(rng, vocab("ColorTone")),
    } as AnimationConfig["visualGrammar"],
  };
}

/**
 * One configuration per rule, built so that rule fires.
 *
 * Rather than hand-craft 63 cases, this searches: sample until each rule has
 * been seen at least once, keeping the first config that trips it. Anything
 * still unseen after the budget is reported by name — an unreachable rule is
 * itself a finding, and it means the parity check would have been silent about
 * that rule either way.
 */
function coveringCorpus(): {
  liveAction: LiveActionConfig[];
  animation: AnimationConfig[];
  unreachable: string[];
} {
  const rng = lcg(0x5eed_1234);
  const liveAction: LiveActionConfig[] = [];
  const animation: AnimationConfig[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < 60_000; i++) {
    const config = randomLiveAction(rng);
    const fired = LIVE_ACTION_RULES.filter((r) => r.check(config)).map((r) => r.ruleId);
    if (fired.some((id) => !seen.has(id))) {
      for (const id of fired) seen.add(id);
      liveAction.push(config);
    }
    if (seen.size === LIVE_ACTION_RULES.length) break;
  }

  const animSeen = new Set<string>();
  for (let i = 0; i < 60_000; i++) {
    const config = randomAnimation(rng);
    const fired = ANIMATION_RULES.filter((r) => r.check(config)).map((r) => r.ruleId);
    if (fired.some((id) => !animSeen.has(id))) {
      for (const id of fired) animSeen.add(id);
      animation.push(config);
    }
    if (animSeen.size === ANIMATION_RULES.length) break;
  }

  const unreachable = [
    ...LIVE_ACTION_RULES.filter((r) => !seen.has(r.ruleId)).map((r) => r.ruleId),
    ...ANIMATION_RULES.filter((r) => !animSeen.has(r.ruleId)).map((r) => r.ruleId),
  ];
  return { liveAction, animation, unreachable };
}

// ---------------------------------------------------------------------------
// The reference engine
// ---------------------------------------------------------------------------

/** `camelCase` back to the Python schema's `snake_case` wire shape. */
function toWire(config: LiveActionConfig | AnimationConfig): Record<string, unknown> {
  if (config.mode === "live_action") {
    return {
      mode: "live_action",
      camera: {
        camera_type: config.camera.cameraType,
        manufacturer: config.camera.manufacturer,
        body: config.camera.body,
        sensor: config.camera.sensor,
        weight_class: config.camera.weightClass,
        film_stock: config.camera.filmStock,
        aspect_ratio: config.camera.aspectRatio,
      },
      lens: {
        manufacturer: config.lens.manufacturer,
        family: config.lens.family,
        focal_length_mm: config.lens.focalLengthMm,
        is_anamorphic: config.lens.isAnamorphic,
        squeeze_ratio: config.lens.squeezeRatio ?? null,
      },
      movement: {
        equipment: config.movement.equipment,
        movement_type: config.movement.movementType,
        timing: config.movement.timing,
      },
      lighting: {
        time_of_day: config.lighting.timeOfDay,
        source: config.lighting.source,
        style: config.lighting.style,
      },
      visual_grammar: {
        shot_size: config.visualGrammar.shotSize,
        composition: config.visualGrammar.composition,
        mood: config.visualGrammar.mood,
        color_tone: config.visualGrammar.colorTone,
      },
      film_preset: config.filmPreset ?? null,
      era: config.era ?? null,
    };
  }
  return {
    mode: "animation",
    medium: config.medium,
    style_domain: config.styleDomain,
    rendering: {
      line_treatment: config.rendering.lineTreatment,
      color_application: config.rendering.colorApplication,
      lighting_model: config.rendering.lightingModel,
      surface_detail: config.rendering.surfaceDetail,
    },
    motion: {
      motion_style: config.motion.motionStyle,
      virtual_camera: config.motion.virtualCamera,
    },
    visual_grammar: {
      shot_size: config.visualGrammar.shotSize,
      composition: config.visualGrammar.composition,
      mood: config.visualGrammar.mood,
      color_tone: config.visualGrammar.colorTone,
    },
    style_preset: config.stylePreset ?? null,
  };
}

interface ReferenceResult {
  status: string;
  messages: Array<{
    ruleId: string;
    severity: string;
    message: string;
    fieldPath: string | null;
  }>;
  prompts: Record<string, { brief: string; detailed: string; negative: string | null }>;
}

async function referenceAvailable(): Promise<string | null> {
  for (const python of [`${CPE_ROOT}/venv/bin/python`, `${CPE_ROOT}/.venv/bin/python`]) {
    try {
      const stat = await Deno.stat(python);
      if (stat.isFile) return python;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

async function runReference(
  python: string,
  configs: ReadonlyArray<LiveActionConfig | AnimationConfig>,
): Promise<ReferenceResult[]> {
  const command = new Deno.Command(python, {
    args: [REFERENCE],
    env: { CPE_ROOT, PYTHONPATH: CPE_ROOT },
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });
  const child = command.spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(JSON.stringify(configs.map(toWire))));
  await writer.close();
  const { code, stdout, stderr } = await child.output();
  const decoder = new TextDecoder();
  if (code !== 0) {
    throw new Error(`reference engine exited ${code}:\n${decoder.decode(stderr)}`);
  }
  return JSON.parse(decoder.decode(stdout)) as ReferenceResult[];
}

/** Normalise ours to the reference's shape so a diff is a diff, not a shape mismatch. */
const normalise = (messages: readonly ValidationMessage[]) =>
  messages.map((m) => ({
    ruleId: m.ruleId,
    severity: m.severity,
    message: m.message,
    fieldPath: m.fieldPath ?? null,
  }));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("cinema parity: every rule is reachable by the sampler", () => {
  const { unreachable, liveAction, animation } = coveringCorpus();
  assertEquals(
    unreachable,
    [],
    "These rules were never triggered by 60 000 sampled configurations, so the parity " +
      "check below says nothing about them. Either the predicate is unsatisfiable, or " +
      "the sampler cannot reach the combination it needs.",
  );
  assert(liveAction.length > 0 && animation.length > 0);
});

Deno.test("cinema parity: the TypeScript engine agrees with the Python original", async () => {
  const python = await referenceAvailable();
  if (!python) {
    console.warn(
      `Director's Console not found at ${CPE_ROOT} — skipping the parity check. ` +
        "Set CPE_ROOT to compare the port against the original.",
    );
    return;
  }

  const rng = lcg(0xc0ffee);
  const covering = coveringCorpus();
  const liveAction: LiveActionConfig[] = [
    DEFAULT_LIVE_ACTION,
    ...covering.liveAction,
    ...Array.from({ length: 400 }, () => randomLiveAction(rng)),
  ];
  const animation: AnimationConfig[] = [
    DEFAULT_ANIMATION,
    ...covering.animation,
    ...Array.from({ length: 400 }, () => randomAnimation(rng)),
  ];

  const all = [...liveAction, ...animation];
  const reference = await runReference(python, all);
  assertEquals(
    reference.length,
    all.length,
    "the reference returned a different number of results",
  );

  let compared = 0;
  for (let i = 0; i < all.length; i++) {
    const config = all[i] as LiveActionConfig | AnimationConfig;
    const expected = reference[i] as ReferenceResult;
    const actual = config.mode === "live_action"
      ? validateLiveAction(config)
      : validateAnimation(config);

    assertEquals(
      normalise(actual.messages),
      expected.messages,
      `Rule output diverged for config #${i}:\n${JSON.stringify(config, null, 2)}`,
    );
    assertEquals(
      actual.status,
      expected.status,
      `Status diverged for config #${i}: ${JSON.stringify(config)}`,
    );

    // The prompt is the other half of the port, and the half a user actually
    // reads. Compare every target and both detail levels.
    for (const target of PROMPT_TARGETS) {
      const reference = expected.prompts[target];
      assert(reference !== undefined, `reference produced no prompt for target ${target}`);
      assertEquals(
        renderPrompt(config, target, { detail: "brief" }).positive,
        reference.brief,
        `Brief prompt for ${target} diverged on config #${i}:\n${JSON.stringify(config, null, 2)}`,
      );
      assertEquals(
        renderPrompt(config, target, { detail: "detailed" }).positive,
        reference.detailed,
        `Detailed prompt for ${target} diverged on config #${i}:\n` +
          JSON.stringify(config, null, 2),
      );
      assertEquals(
        negativePrompt(target),
        reference.negative,
        `Negative prompt for ${target} diverged`,
      );
    }
    compared++;
  }

  console.log(
    `cinema parity: ${compared} configurations agree with the Python engine ` +
      `on rules and on ${PROMPT_TARGETS.length} prompt targets`,
  );
});

Deno.test("cinema parity: every preset applies to the same configuration", async () => {
  const python = await referenceAvailable();
  if (!python) {
    console.warn(
      `Director's Console not found at ${CPE_ROOT} — skipping the preset-application check.`,
    );
    return;
  }

  const { loadLibrary, PRESET_MAPPINGS } = await import("../bridge/library.ts");
  const { applyPreset } = await import("../core/cinema/rules.ts");
  const { presets } = await loadLibrary();

  const command = new Deno.Command(python, {
    args: [REFERENCE, "--apply-presets"],
    env: { CPE_ROOT, PYTHONPATH: CPE_ROOT },
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await command.output();
  const decoder = new TextDecoder();
  assertEquals(code, 0, `reference engine failed:\n${decoder.decode(stderr)}`);

  const expected = JSON.parse(decoder.decode(stdout)) as Record<string, {
    config: Record<string, unknown>;
    messages: Array<
      { ruleId: string; severity: string; message: string; fieldPath: string | null }
    >;
  }>;

  let compared = 0;

  for (const film of presets.films()) {
    const reference = expected[`live_action:${film.id}`];
    assert(reference !== undefined, `reference produced no application for ${film.id}`);
    const applied = applyPreset(film, CINEMA_VOCABULARIES, PRESET_MAPPINGS, presets);
    assertEquals(
      toWire(applied.config),
      { mode: "live_action", ...reference.config },
      `Applying preset '${film.id}' produced a different configuration.`,
    );
    assertEquals(
      normalise(applied.validation.messages),
      reference.messages,
      `Applying preset '${film.id}' produced different validation messages.`,
    );
    compared++;
  }

  for (const style of presets.styles()) {
    const reference = expected[`animation:${style.id}`];
    assert(reference !== undefined, `reference produced no application for ${style.id}`);
    const applied = applyPreset(style, CINEMA_VOCABULARIES, PRESET_MAPPINGS, presets);
    assertEquals(
      toWire(applied.config),
      { mode: "animation", ...reference.config },
      `Applying preset '${style.id}' produced a different configuration.`,
    );
    assertEquals(
      normalise(applied.validation.messages),
      reference.messages,
      `Applying preset '${style.id}' produced different validation messages.`,
    );
    compared++;
  }

  console.log(`cinema parity: ${compared} presets apply identically to the Python engine`);
});
