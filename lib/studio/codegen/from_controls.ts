/**
 * from_controls.ts — generate node types from the restorer's control schema.
 *
 * ## Why this file exists
 *
 * `ArchiveRestorer/shared/controls.json` is already the single source of truth
 * for the restoration parameters: the Deno UI generates every slider from it,
 * and the Python engine validates ranges against it. If WIV hand-wrote its own
 * node ports, there would be a third copy of the same knowledge, and the day
 * someone widens `clahe.clip_limit` in the engine, a blueprint node would keep
 * offering the old range and produce values the backend rejects.
 *
 * So the ports are *derived*. A control becomes a port; its `min`/`max`/`step`
 * become the port's `NumericRange`; its `options` become the port's closed
 * enum; its `help` becomes the port's help text. Drift is impossible because
 * there is nothing to keep in sync.
 *
 * [AGENT-VOCABULARY] `--check` re-runs the generation and diffs it against the
 * committed output, failing if they differ. That turns "did someone edit the
 * generated file by hand" into a build error instead of a mystery.
 *
 * Usage:
 *   deno run --allow-read --allow-write codegen/from_controls.ts
 *   deno run --allow-read          codegen/from_controls.ts --check
 */

import { emitCss } from "../core/tokens.ts";

// ---------------------------------------------------------------------------
// The shape of controls.json, restated as types so parsing is checked.
// ---------------------------------------------------------------------------

interface ControlDef {
  key: string;
  type: "range" | "number" | "select" | "toggle";
  label: string;
  help?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  scale?: number;
  options?: string[];
  showIf?: Record<string, unknown>;
}

interface SectionDef {
  key: string;
  label: string;
  hint: string;
  controls: ControlDef[];
}

interface ControlsFile {
  version: number;
  sections: SectionDef[];
}

/**
 * The control schema is now *vendored* at `engines/restorer/controls.json`:
 * the port of ArchiveRestorer into this repo made the sibling checkout
 * optional, and a build that silently reached outside its own tree would
 * generate different nodes on a machine that happened to have the old repo.
 * `RESTORER_ROOT` still overrides, so the original checkout can be pointed at
 * while the port is verified against it.
 */
const VENDORED_CONTROLS = new URL("../engines/restorer/controls.json", import.meta.url).pathname;
const RESTORER_ROOT = Deno.env.get("RESTORER_ROOT");
const CONTROLS_PATH = RESTORER_ROOT ? `${RESTORER_ROOT}/shared/controls.json` : VENDORED_CONTROLS;
const VENDORED_DEFAULTS = new URL("../engines/restorer/defaults.json", import.meta.url).pathname;
const OUT_NODES = new URL("../gen/stage_nodes.ts", import.meta.url).pathname;
const OUT_DEFAULTS = new URL("../gen/engine_defaults.json", import.meta.url).pathname;
const OUT_CSS = new URL("../ui/public/tokens.css", import.meta.url).pathname;

/**
 * Which signal each stage consumes and produces.
 *
 * Every restoration stage is Image → Image, but three of them are *temporal*:
 * they read neighbouring frames, not just the current one. Those take a
 * `Sequence` alongside the frame, and declaring that in the port kinds is what
 * stops a user wiring a deflicker node to a single still and wondering why the
 * window parameter does nothing. The engine's own docstring is the authority
 * for which stages these are.
 */
const TEMPORAL_STAGES = new Set(["stabilize", "temporal_fusion", "deflicker", "defect", "reframe"]);

/** Stages whose output is geometric and therefore invalidates any existing matte. */
const GEOMETRIC_STAGES = new Set(["stabilize", "level", "reframe"]);

/** The engine's own per-stage default values, keyed stage → control → value. */
type EngineDefaults = Record<string, Record<string, unknown>>;

/**
 * Read `pipeline.DEFAULT_PARAMS` out of the running engine.
 *
 * `controls.json` declares each control's *domain* but not its *value* — the
 * values live in `pipeline.py`, which is the module that consumes them. Rather
 * than transcribe them (a third copy, guaranteed to rot), codegen asks Python
 * for them directly and commits the answer as `gen/engine_defaults.json`.
 *
 * When the interpreter is unavailable — a CI box with no venv, a checkout
 * without the engine — the committed snapshot is used instead and the fact is
 * reported. Generating *without* defaults is not an option: a node whose
 * parameters have no values compiles to a request the engine rejects.
 */
/**
 * The stage defaults.
 *
 * These used to be read by *running* the Python engine — the only honest
 * source while the engine was Python. The port moved them into the tree at
 * `engines/restorer/defaults.json`, so the generator no longer needs a working
 * `.venv` to build. Setting `RESTORER_ROOT` still prefers the live Python
 * values, which is how the vendored copy is checked against the original.
 *
 * Note it must NOT fall back to `gen/engine_defaults.json`: that file is this
 * function's own output, and a generator that reads its own output cannot
 * detect drift — it would agree with itself forever.
 */
async function loadEngineDefaults(): Promise<{ defaults: EngineDefaults; source: string }> {
  if (RESTORER_ROOT) {
    try {
      const command = new Deno.Command(`${RESTORER_ROOT}/.venv/bin/python`, {
        args: ["-c", "import json, pipeline; print(json.dumps(pipeline.DEFAULT_PARAMS))"],
        cwd: `${RESTORER_ROOT}/backend`,
        stdout: "piped",
        stderr: "piped",
      });
      const { code, stdout } = await command.output();
      if (code === 0) {
        const parsed = JSON.parse(new TextDecoder().decode(stdout)) as EngineDefaults;
        return { defaults: parsed, source: "pipeline.DEFAULT_PARAMS (live Python engine)" };
      }
    } catch {
      // RESTORER_ROOT was set but is not runnable; the vendored copy still is.
    }
  }
  try {
    const vendored = JSON.parse(await Deno.readTextFile(VENDORED_DEFAULTS)) as EngineDefaults;
    return { defaults: vendored, source: "engines/restorer/defaults.json" };
  } catch {
    throw new Error(
      "Cannot read engines/restorer/defaults.json. Restore it from version control, " +
        "or set RESTORER_ROOT to a checkout of the original Python engine.",
    );
  }
}

/** Render one default value as a `SignalValue` literal, or `null` if unrepresentable. */
function defaultLiteral(kind: string, value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (kind === "Number") {
    return typeof value === "number" && Number.isFinite(value)
      ? `{ kind: "Number", value: ${value} }`
      : null;
  }
  if (kind === "Flag") {
    return typeof value === "boolean" ? `{ kind: "Flag", value: ${value} }` : null;
  }
  if (kind === "Enum") {
    return typeof value === "string" ? `{ kind: "Enum", value: ${quote(value)} }` : null;
  }
  return null;
}

const identifier = (text: string): string =>
  text.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^(\d)/, "_$1");

const quote = (text: string): string => JSON.stringify(text);

/** Turn one control into a port literal, carrying the engine's own default. */
function portLiteral(
  control: ControlDef,
  indent: string,
  stageDefaults: Record<string, unknown>,
): string {
  const lines: string[] = [];
  const help = control.help ??
    `${control.label} for this stage. See the engine's controls schema.`;

  const kind = control.type === "toggle" ? "Flag" : control.type === "select" ? "Enum" : "Number";

  lines.push(`${indent}{`);
  lines.push(`${indent}  id: asPortId(${quote(control.key)}),`);
  lines.push(`${indent}  label: ${quote(control.label)},`);
  lines.push(`${indent}  direction: "input",`);
  lines.push(`${indent}  kind: ${quote(kind)},`);
  lines.push(`${indent}  help: ${quote(help)},`);

  if (kind === "Number") {
    const min = control.min ?? 0;
    const max = control.max ?? 1;
    const step = control.step ?? 0;
    const unit = control.unit ? `, unit: ${quote(control.unit)}` : "";
    const scale = control.scale && control.scale !== 1 ? `, displayScale: ${control.scale}` : "";
    lines.push(
      `${indent}  range: { min: ${min}, max: ${max}, step: ${step}${unit}${scale} },`,
    );
  }
  if (kind === "Enum" && control.options) {
    lines.push(`${indent}  options: [${control.options.map(quote).join(", ")}],`);
  }
  const literal = defaultLiteral(kind, stageDefaults[control.key]);
  if (literal) lines.push(`${indent}  defaultValue: ${literal},`);
  lines.push(`${indent}},`);
  return lines.join("\n");
}

function generateNodes(controls: ControlsFile, defaults: EngineDefaults): string {
  const out: string[] = [];
  out.push(
    "/**",
    " * stage_nodes.ts — GENERATED. Do not edit.",
    " *",
    ` * Source: ArchiveRestorer/shared/controls.json (version ${controls.version})`,
    " * Regenerate: deno task codegen",
    " *",
    " * Every restoration stage the engine exposes, as a blueprint node whose",
    " * parameter ports carry the engine's own ranges, units and help text. The",
    " * ranges here are the ranges the Python side validates against, because",
    " * they are read from the same file.",
    " */",
    "",
    'import { asNodeTypeId, asPortId } from "../core/ids.ts";',
    'import type { NodeTypeSpec } from "../core/registry.ts";',
    "",
    "/** The order the engine applies these stages in. Wiring them out of order is",
    "  * allowed — the graph is the authority — but `STAGE_ORDER` is what an",
    "  * auto-layout uses to build the default chain. */",
    `export const STAGE_ORDER: readonly string[] = [${
      controls.sections.map((s) => quote(s.key)).join(", ")
    }];`,
    "",
  );

  const names: string[] = [];
  for (const section of controls.sections) {
    const varName = `STAGE_${identifier(section.key).toUpperCase()}`;
    names.push(varName);
    const stageDefaults = defaults[section.key] ?? {};
    const temporal = TEMPORAL_STAGES.has(section.key);
    const geometric = GEOMETRIC_STAGES.has(section.key);

    out.push(`/** ${section.hint} */`);
    out.push(`export const ${varName}: NodeTypeSpec = {`);
    out.push(`  id: asNodeTypeId(${quote(`stage.${section.key}`)}),`);
    out.push(`  category: "stage",`);
    out.push(`  label: ${quote(section.label)},`);
    out.push(`  hint: ${quote(section.hint)},`);
    out.push(`  cost: "local",`);
    out.push(`  engineStage: ${quote(section.key)},`);
    // Card height: header + one row per control, clamped so a 11-control node
    // stays a card rather than a column.
    const height = Math.min(420, 76 + section.controls.length * 26);
    out.push(`  size: { w: 248, h: ${height} },`);

    out.push("  inputs: [");
    out.push("    {");
    out.push('      id: asPortId("image"),');
    out.push('      label: "Frame",');
    out.push('      direction: "input",');
    out.push('      kind: "Image",');
    out.push('      help: "The frame this stage processes.",');
    out.push("    },");
    if (temporal) {
      out.push("    {");
      out.push('      id: asPortId("neighbours"),');
      out.push('      label: "Neighbours",');
      out.push('      direction: "input",');
      out.push('      kind: "Sequence",');
      out.push(
        '      help: "Surrounding frames. This stage compares across time, so without them it has nothing to work from.",',
      );
      out.push("    },");
    }
    out.push("    {");
    out.push('      id: asPortId("enabled"),');
    out.push('      label: "Enabled",');
    out.push('      direction: "input",');
    out.push('      kind: "Flag",');
    out.push('      help: "Switch the stage out without unwiring it.",');
    out.push(
      `      defaultValue: { kind: "Flag", value: ${stageDefaults.enabled === true} },`,
    );
    out.push("    },");
    for (const control of section.controls) {
      out.push(portLiteral(control, "    ", stageDefaults));
    }
    out.push("  ],");

    out.push("  outputs: [");
    out.push("    {");
    out.push('      id: asPortId("image"),');
    out.push('      label: "Result",');
    out.push('      direction: "output",');
    out.push('      kind: "Image",');
    out.push(`      help: ${quote(`The frame after ${section.label.toLowerCase()}.`)},`);
    out.push("    },");
    if (geometric) {
      out.push("    {");
      out.push('      id: asPortId("warp"),');
      out.push('      label: "Warp",');
      out.push('      direction: "output",');
      out.push('      kind: "Flow",');
      out.push(
        '      help: "The geometric correction this stage applied. Feed it to a matte so an existing mask follows the picture.",',
      );
      out.push("    },");
    }
    out.push("  ],");
    out.push("};");
    out.push("");
  }

  out.push("/** Every generated stage node, in engine order. */");
  out.push(`export const STAGE_NODES: readonly NodeTypeSpec[] = [`);
  for (const name of names) out.push(`  ${name},`);
  out.push("];");
  out.push("");
  return out.join("\n");
}

// ---------------------------------------------------------------------------

export async function main(): Promise<void> {
  const check = Deno.args.includes("--check");

  // `RESTORER_ROOT` is a preference, not a requirement. It is commonly left set
  // in a shell after pointing at a checkout that has since moved, and a build
  // that dies on a stale environment variable — while a perfectly good vendored
  // copy sits in the tree — is a build that fails for no reason.
  let raw: string;
  try {
    raw = await Deno.readTextFile(CONTROLS_PATH);
  } catch (error) {
    if (CONTROLS_PATH !== VENDORED_CONTROLS) {
      console.warn(
        `RESTORER_ROOT points at ${CONTROLS_PATH}, which cannot be read ` +
          `(${error instanceof Error ? error.message : error}).\n` +
          "Falling back to the vendored schema at engines/restorer/controls.json.",
      );
      try {
        raw = await Deno.readTextFile(VENDORED_CONTROLS);
      } catch {
        console.error(
          "Neither the engine's control schema nor the vendored copy could be read.\n" +
            `  ${CONTROLS_PATH}\n  ${VENDORED_CONTROLS}\n` +
            "Restore engines/restorer/controls.json from version control.",
        );
        Deno.exit(2);
      }
    } else {
      console.error(
        `Cannot read the vendored control schema at:\n  ${CONTROLS_PATH}\n` +
          "The stage nodes are generated from it, so it cannot be missing.\n" +
          "Restore it from version control, or set RESTORER_ROOT to a checkout.\n",
        error instanceof Error ? error.message : error,
      );
      Deno.exit(2);
    }
  }

  const controls = JSON.parse(raw) as ControlsFile;
  if (!Array.isArray(controls.sections) || controls.sections.length === 0) {
    console.error("controls.json has no sections — refusing to generate an empty registry.");
    Deno.exit(2);
  }

  const { defaults, source } = await loadEngineDefaults();

  // Every stage in the schema must have defaults, or its node compiles to an
  // incomplete request. Catch that here rather than at render time.
  const missing = controls.sections.filter((s) => !defaults[s.key]).map((s) => s.key);
  if (missing.length > 0) {
    console.error(
      `These stages appear in controls.json but not in the engine's defaults: ${
        missing.join(", ")
      }.\n` +
        "The two files have diverged; fix the engine before regenerating.",
    );
    Deno.exit(2);
  }

  const artefacts: ReadonlyArray<{ path: string; body: string; name: string }> = [
    { path: OUT_NODES, body: generateNodes(controls, defaults), name: "gen/stage_nodes.ts" },
    {
      path: OUT_DEFAULTS,
      // Canonical key order. The live engine and the vendored copy hold the same
      // values in different orders; writing them as found made `--check` fail
      // after every ./start.sh that read the live engine, with nothing changed.
      body: JSON.stringify(sortKeys(defaults), null, 2) + "\n",
      name: "gen/engine_defaults.json",
    },
    { path: OUT_CSS, body: emitCss() + "\n", name: "ui/public/tokens.css" },
  ];

  let drifted = 0;
  for (const artefact of artefacts) {
    if (check) {
      let existing = "";
      try {
        existing = await Deno.readTextFile(artefact.path);
      } catch {
        console.error(`✗ ${artefact.name} is missing. Run: deno task codegen`);
        drifted++;
        continue;
      }
      if (existing !== artefact.body) {
        console.error(`✗ ${artefact.name} is out of date with its source. Run: deno task codegen`);
        drifted++;
      } else {
        console.log(`✓ ${artefact.name} matches its source`);
      }
    } else {
      await Deno.mkdir(artefact.path.slice(0, artefact.path.lastIndexOf("/")), { recursive: true });
      await Deno.writeTextFile(artefact.path, artefact.body);
      console.log(`wrote ${artefact.name}`);
    }
  }

  if (check && drifted > 0) Deno.exit(1);
  if (!check) {
    const controlCount = controls.sections.reduce((n, s) => n + s.controls.length, 0);
    console.log(
      `${controls.sections.length} stage nodes, ${controlCount} parameter ports, ` +
        `from controls.json v${controls.version}; defaults from ${source}`,
    );
  }
}

/** Recursively sort object keys, so equal data always serialises to equal bytes. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>).sort().map((
        k,
      ) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}
