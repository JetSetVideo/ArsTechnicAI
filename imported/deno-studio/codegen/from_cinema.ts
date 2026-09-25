/**
 * from_cinema.ts — generate the cinema vocabulary from the reference library.
 *
 * ## Why this file exists
 *
 * The Cinema Prompt Engineering rules engine arrived as ~6 700 lines of Python
 * whose whole point is that *only physically possible configurations exist*:
 * you cannot mount a Panavision lens on a non-Panavision body, cannot light a
 * 1940s picture with an LED panel, cannot handhold an IMAX camera. That
 * guarantee is only as good as the vocabulary it quantifies over — 35 closed
 * sets, 573 terms — and a vocabulary transcribed by hand is a vocabulary that
 * drifts.
 *
 * So `library/cinema/vocabulary.json` is the source and this emits the types.
 * Each enum becomes a **string-literal union** plus a frozen option list, which
 * buys the thing the Python original could not have: `camera.body` typed as
 * `CameraBody` means a misspelled body is a compile error rather than a rule
 * that silently never fires. Several of the ported rules test set membership —
 * a term missing from a set fails open, and failing open here means the app
 * says a physically impossible setup is fine.
 *
 * [AGENT-VOCABULARY] `--check` re-runs the generation and diffs it against the
 * committed output, matching `from_controls.ts`. Editing `gen/` by hand is a
 * build error, not a mystery.
 *
 * Usage:
 *   deno run --allow-read --allow-write codegen/from_cinema.ts
 *   deno run --allow-read              codegen/from_cinema.ts --check
 */

const VOCAB_PATH = new URL("../library/cinema/vocabulary.json", import.meta.url).pathname;
const COMPAT_PATH = new URL("../library/cinema/compatibility.json", import.meta.url).pathname;
const MAPPINGS_PATH = new URL("../library/cinema/mappings.json", import.meta.url).pathname;
const OUT_VOCAB = new URL("../gen/cinema_vocabulary.ts", import.meta.url).pathname;
const OUT_COMPAT = new URL("../gen/cinema_compat.ts", import.meta.url).pathname;
const OUT_MAPPINGS = new URL("../gen/cinema_mappings.ts", import.meta.url).pathname;

interface EnumDef {
  /** Which schema module declared it — `common`, `live_action` or `animation`. */
  module: string;
  values: string[];
}

type VocabularyFile = Record<string, EnumDef>;

/**
 * The physical-compatibility tables: which bodies take film, which mount is a
 * closed ecosystem, which sensors are large-format, and how much every body
 * weighs. Extracted from the rules engine rather than transcribed, because
 * these sets are what several rules quantify over and a body missing from
 * `FILM_CAMERA_BODIES` does not fail loudly — it quietly declares a film
 * camera digital and stops asking for a stock.
 */
interface CompatibilityFile {
  sets: Record<string, string[]>;
  weightClass: Record<string, string>;
}

/**
 * The alias tables that turn a hand-written preset into a typed config.
 *
 * Presets say `Wide_Shot`, `Slow_Dolly` and `Muted`; the vocabulary says `WS`,
 * `Dolly` and `Neutral_Desaturated`. Without these tables every such term
 * misses, the field silently keeps its default, and a film preset applies as
 * something close to nothing. Extracted from the original engine by AST rather
 * than transcribed — `movementAliases` alone is 30 entries pointing at three
 * different config fields.
 */
interface MappingsFile {
  cameraManufacturerByBody: Record<string, string>;
  lensManufacturerAliases: Record<string, string>;
  lensFamilyAliases: Record<string, string>;
  movementAliases: Record<string, { field: string | null; value: string }>;
  shotSizeAliases: Record<string, string>;
  compositionAliases: Record<string, string>;
  colorToneAliases: Record<string, string>;
  styleDomainAliases: Record<string, string>;
  animationMediumAliases: Record<string, string>;
}

/**
 * Terms are `Snake_Case` identifiers, except the aspect ratios, which are
 * `2.35:1` and friends. Anything outside those two shapes means the export
 * picked up something that is not a vocabulary term, and generating from it
 * would produce a union with a broken literal in it.
 */
const TERM = /^[A-Za-z0-9_.:\-/ ]+$/;

const quote = (text: string): string => JSON.stringify(text);

/** `CameraBody` → `CAMERA_BODIES`-ish: the frozen list that accompanies a union. */
function listName(enumName: string): string {
  const screaming = enumName.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
  return `${screaming}_VALUES`;
}

function generate(vocab: VocabularyFile): string {
  const names = Object.keys(vocab).sort();
  const byModule = new Map<string, string[]>();
  for (const name of names) {
    const def = vocab[name];
    if (!def) continue;
    const bucket = byModule.get(def.module) ?? [];
    bucket.push(name);
    byModule.set(def.module, bucket);
  }

  const termCount = names.reduce((n, name) => n + (vocab[name]?.values.length ?? 0), 0);

  const out: string[] = [];
  out.push("/**");
  out.push(" * cinema_vocabulary.ts — GENERATED. Do not edit.");
  out.push(" *");
  out.push(" * Source: library/cinema/vocabulary.json");
  out.push(" * Regenerate: deno task codegen");
  out.push(" *");
  out.push(
    ` * ${names.length} closed vocabularies, ${termCount} terms: every camera body, lens family,`,
  );
  out.push(" * film stock, lighting instrument, movement, mood and composition the rules engine");
  out.push(" * quantifies over. A union rather than an enum so a term is its own literal and a");
  out.push(" * misspelling cannot reach a set-membership test.");
  out.push(" */");
  out.push("");

  for (const module of [...byModule.keys()].sort()) {
    const members = byModule.get(module) ?? [];
    out.push(`// ${"-".repeat(74)}`);
    out.push(`// ${module}`);
    out.push(`// ${"-".repeat(74)}`);
    out.push("");
    for (const name of members) {
      const def = vocab[name];
      if (!def) continue;
      const values = def.values;
      out.push(`/** ${values.length} terms. */`);
      if (values.length === 0) {
        out.push(`export type ${name} = never;`);
      } else {
        out.push(`export type ${name} =`);
        for (const value of values) {
          out.push(`  | ${quote(value)}`);
        }
        out[out.length - 1] += ";";
      }
      out.push(`export const ${listName(name)}: readonly ${name}[] = Object.freeze([`);
      for (const value of values) out.push(`  ${quote(value)},`);
      out.push("]);");
      out.push("");
    }
  }

  out.push(`// ${"-".repeat(74)}`);
  out.push("// Reflection");
  out.push(`// ${"-".repeat(74)}`);
  out.push("");
  out.push("/**");
  out.push(" * Every vocabulary by name, for the UI that has to render a picker for a field");
  out.push(" * it only knows by string. Values are the same frozen arrays declared above, so");
  out.push(" * this costs a map, not a second copy of 573 strings.");
  out.push(" */");
  out.push("export const CINEMA_VOCABULARIES: Readonly<Record<string, readonly string[]>> =");
  out.push("  Object.freeze({");
  for (const name of names) out.push(`    ${name}: ${listName(name)},`);
  out.push("  });");
  out.push("");

  return out.join("\n");
}

function generateCompat(compat: CompatibilityFile, vocab: VocabularyFile): string {
  const bodies = new Set(vocab.CameraBody?.values ?? []);
  const families = new Set(vocab.LensFamily?.values ?? []);

  const out: string[] = [];
  out.push("/**");
  out.push(" * cinema_compat.ts — GENERATED. Do not edit.");
  out.push(" *");
  out.push(" * Source: library/cinema/compatibility.json");
  out.push(" * Regenerate: deno task codegen");
  out.push(" *");
  out.push(" * The physical facts the rules quantify over: which bodies run film, which");
  out.push(" * mounts are closed, which sensors are large-format, what every body weighs.");
  out.push(" * `Set` rather than array because every use is a membership test on a hot path");
  out.push(" * — validation runs on each keystroke in the inspector.");
  out.push(" */");
  out.push("");
  out.push('import type { CameraBody, LensFamily, WeightClass } from "./cinema_vocabulary.ts";');
  out.push("");

  const setType = (name: string): string => name.includes("LENS") ? "LensFamily" : "CameraBody";

  for (const name of Object.keys(compat.sets).sort()) {
    const values = compat.sets[name] ?? [];
    out.push(`/** ${values.length} entries. */`);
    out.push(`export const ${name}: ReadonlySet<${setType(name)}> = new Set([`);
    for (const value of values) out.push(`  ${quote(value)},`);
    out.push("]);");
    out.push("");
  }

  out.push("/**");
  out.push(" * What each body weighs, as a class.");
  out.push(" *");
  out.push(" * A body absent from this map is `UltraLight`, which is what the Python");
  out.push(" * original returned as its fallback — but every body in the vocabulary is");
  out.push(" * present here, so the fallback is unreachable and stays a total function.");
  out.push(" */");
  out.push("export const BODY_WEIGHT_CLASS: Readonly<Record<CameraBody, WeightClass>> =");
  out.push("  Object.freeze({");
  for (const body of Object.keys(compat.weightClass).sort()) {
    out.push(`    ${quote(body)}: ${quote(compat.weightClass[body] ?? "UltraLight")},`);
  }
  out.push("  } as Record<CameraBody, WeightClass>);");
  out.push("");

  const unknownBodies = Object.keys(compat.weightClass).filter((b) => !bodies.has(b));
  const unknownFamilies = (compat.sets.PANAVISION_LENS_FAMILIES ?? []).filter((f) =>
    !families.has(f)
  );
  if (unknownBodies.length > 0 || unknownFamilies.length > 0) {
    throw new Error(
      "compatibility.json names terms that are not in the vocabulary: " +
        [...unknownBodies, ...unknownFamilies].join(", "),
    );
  }

  return out.join("\n");
}

function generateMappings(mappings: MappingsFile): string {
  const out: string[] = [];
  out.push("/**");
  out.push(" * cinema_mappings.ts — GENERATED. Do not edit.");
  out.push(" *");
  out.push(" * Source: library/cinema/mappings.json");
  out.push(" * Regenerate: deno task codegen");
  out.push(" *");
  out.push(" * How a preset's hand-written terms map onto the closed vocabulary, and which");
  out.push(" * manufacturer each camera body belongs to. Without these, applying a film");
  out.push(" * preset silently keeps the defaults for every field it cannot resolve.");
  out.push(" */");
  out.push("");

  const simple: ReadonlyArray<readonly [string, Record<string, string>, string]> = [
    ["CAMERA_MANUFACTURER_BY_BODY", mappings.cameraManufacturerByBody, "body -> manufacturer"],
    ["LENS_MANUFACTURER_ALIASES", mappings.lensManufacturerAliases, "studio name -> lens maker"],
    ["LENS_FAMILY_ALIASES", mappings.lensFamilyAliases, "loose family name -> family"],
    ["SHOT_SIZE_ALIASES", mappings.shotSizeAliases, "spelled-out shot size -> code"],
    ["COMPOSITION_ALIASES", mappings.compositionAliases, "spaced name -> identifier"],
    ["COLOR_TONE_ALIASES", mappings.colorToneAliases, "short name -> full tone"],
    ["STYLE_DOMAIN_ALIASES", mappings.styleDomainAliases, "preset domain -> StyleDomain"],
    ["ANIMATION_MEDIUM_ALIASES", mappings.animationMediumAliases, "preset medium -> medium"],
  ];

  for (const [name, table, what] of simple) {
    out.push(`/** ${what} (${Object.keys(table).length}). */`);
    out.push(`export const ${name}: Readonly<Record<string, string>> = Object.freeze({`);
    for (const key of Object.keys(table).sort()) {
      out.push(`  ${quote(key)}: ${quote(table[key] ?? "")},`);
    }
    out.push("});");
    out.push("");
  }

  out.push("/**");
  out.push(" * Movement aliases, each naming *which* field it sets.");
  out.push(" *");
  out.push(" * A preset's single `movement` string may be equipment (`Slow_Dolly` -> Dolly),");
  out.push(" * a movement type (`Slow_Push_In` -> Push_In) or a timing (`Slow` -> Slow), and");
  out.push(" * writing one into the wrong field is invisible until a rule fails to fire.");
  out.push(" */");
  out.push('export type MovementField = "equipment" | "movementType" | "timing";');
  out.push("export const MOVEMENT_ALIASES: Readonly<");
  out.push("  Record<string, { readonly field: MovementField; readonly value: string }>");
  out.push("> = Object.freeze({");
  for (const key of Object.keys(mappings.movementAliases).sort()) {
    const entry = mappings.movementAliases[key];
    if (!entry || entry.field === null) {
      throw new Error(`movement alias ${key} resolves to no config field`);
    }
    out.push(`  ${quote(key)}: { field: ${quote(entry.field)}, value: ${quote(entry.value)} },`);
  }
  out.push("});");
  out.push("");

  return out.join("\n");
}

export async function main(): Promise<void> {
  const check = Deno.args.includes("--check");
  const vocab = JSON.parse(await Deno.readTextFile(VOCAB_PATH)) as VocabularyFile;
  const compat = JSON.parse(await Deno.readTextFile(COMPAT_PATH)) as CompatibilityFile;
  const mappings = JSON.parse(await Deno.readTextFile(MAPPINGS_PATH)) as MappingsFile;

  const bad: string[] = [];
  for (const [name, def] of Object.entries(vocab)) {
    if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) bad.push(`enum name ${name}`);
    for (const value of def.values) {
      if (!TERM.test(value)) bad.push(`${name}.${value}`);
    }
  }
  if (bad.length > 0) {
    console.error(
      `vocabulary.json holds entries that are not vocabulary terms:\n  ${bad.join("\n  ")}`,
    );
    Deno.exit(2);
  }

  const artefacts: ReadonlyArray<{ path: string; body: string; name: string }> = [
    { path: OUT_VOCAB, body: generate(vocab), name: "gen/cinema_vocabulary.ts" },
    { path: OUT_COMPAT, body: generateCompat(compat, vocab), name: "gen/cinema_compat.ts" },
    { path: OUT_MAPPINGS, body: generateMappings(mappings), name: "gen/cinema_mappings.ts" },
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
      await Deno.writeTextFile(artefact.path, artefact.body);
      console.log(`wrote ${artefact.name}`);
    }
  }

  if (check && drifted > 0) Deno.exit(1);
  if (!check) {
    const terms = Object.values(vocab).reduce((n, d) => n + d.values.length, 0);
    console.log(
      `${Object.keys(vocab).length} vocabularies, ${terms} terms; ` +
        `${Object.keys(compat.sets).length} compatibility sets, ` +
        `${Object.keys(compat.weightClass).length} bodies weighed, ` +
        `${Object.keys(mappings.movementAliases).length} movement aliases`,
    );
  }
}
