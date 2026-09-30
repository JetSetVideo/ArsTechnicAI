/**
 * tokens.ts — typography, colour and elevation, as types rather than CSS.
 *
 * The dual-typography rule and the three-state filter are stated here as
 * *functions returning tokens*, not as a stylesheet, for one reason: a rule
 * expressed in CSS is a convention that a future component can quietly break,
 * while a rule expressed as the only way to obtain a class name is enforced by
 * the compiler. `emitCss()` at the bottom generates the stylesheet from these
 * definitions, so the two can never drift.
 *
 * [AGENT-DESIGNER] owns this file.
 */

// ===========================================================================
// Dual typography
// ===========================================================================

/**
 * The two type roles, and the distinction they encode.
 *
 * `primary` is the system speaking: labels, actions, stage names, units. It is
 * hard-coded, identical in every project, and translatable.
 *
 * `secondary` is the *project* speaking: file names, paths, numeric values,
 * prompts, section names. It is data, it varies per project, and it is the
 * text a user may need to select, copy or compare character by character.
 *
 * Rendering them in the same face is the specific failure this rule exists to
 * prevent: when `deflicker window 9` is one undifferentiated string, there is
 * no way to see at a glance which half you may change. Secondary is therefore
 * monospaced — so digits align down a column of nodes and `l`/`1`/`I` are
 * distinguishable in a path — and tinted by its signal colour.
 */
export type TypeRole = "primary" | "secondary";

export interface TypeToken {
  readonly role: TypeRole;
  readonly fontFamily: string;
  readonly fontWeight: number;
  /** Letter spacing in em. Positive on primary at small sizes for legibility. */
  readonly letterSpacing: number;
  /** True when the text is project data the user may select and copy. */
  readonly selectable: boolean;
  readonly cssClass: string;
}

const SYSTEM_SANS =
  '-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Arial, sans-serif';
const SYSTEM_MONO = '"SF Mono", ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace';

export const TYPE_TOKENS: Readonly<Record<TypeRole, TypeToken>> = {
  primary: {
    role: "primary",
    fontFamily: SYSTEM_SANS,
    fontWeight: 500,
    letterSpacing: 0.01,
    selectable: false,
    cssClass: "t-primary",
  },
  secondary: {
    role: "secondary",
    fontFamily: SYSTEM_MONO,
    fontWeight: 400,
    letterSpacing: 0,
    selectable: true,
    cssClass: "t-secondary",
  },
};

/**
 * Classify a string by what it *is*, so a component cannot pick the wrong role
 * by accident.
 *
 * Deliberately conservative: anything that is a bare word with no digits,
 * path separator or punctuation is treated as a system label. Values, paths
 * and identifiers are secondary. When in doubt the caller should pass the role
 * explicitly rather than rely on this.
 */
export function inferTypeRole(text: string): TypeRole {
  if (/[\/\\.]/.test(text)) return "secondary"; // a path or a dotted identifier
  if (/\d/.test(text)) return "secondary"; // carries a value
  if (/^[a-z0-9_]+$/.test(text) && text.includes("_")) return "secondary"; // a key
  return "primary";
}

// ===========================================================================
// The dark baseline and elevation
// ===========================================================================

/**
 * Surface colours. `canvas` is the brief's mandated `#0D0D11`; every other
 * surface is derived from it by `elevate()` rather than being an independent
 * hex literal, so the whole scheme moves together if the baseline changes.
 */
export const CANVAS_BASE = "#0d0d11";

/** Relative luminance shift per elevation step. The brief's "+15%". */
const LUMINANCE_STEP = 0.15;

/**
 * Minimum absolute shift per step, in sRGB levels.
 *
 * A purely relative lift is useless at the bottom of the range: 15% of the
 * canvas's own value is 13 × 0.15 ≈ 2 levels, which is invisible. A floor of
 * 10 levels keeps every step perceptible on near-black while leaving the
 * relative term in charge higher up, where it is the term that matters.
 */
const LUMINANCE_FLOOR = 10;

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export function parseHex(hex: string): Rgb {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean.padEnd(6, "0").slice(0, 6);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export const toHex = ({ r, g, b }: Rgb): string =>
  "#" +
  [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0"))
    .join("");

/**
 * Raise or lower a colour by `steps` elevation levels.
 *
 * The shift per step is `max(value × 15%, 10 levels)`, applied once per step so
 * the ramp compounds. Two cheaper formulations were tried and both fail:
 *
 *   - **Pure scaling** (`× 1.15`) turns `#0d0d11` into `#0f0f14`, a two-level
 *     change nobody can see. Every dark surface collapses into the canvas.
 *   - **Lerp toward white by 15%** turns it into `#313135` — a 3.8× jump in
 *     luminance for what is meant to be a hover. The whole ramp lands in
 *     mid-grey by elevation 2 and the "dark baseline" is gone.
 *
 * The floor keeps steps visible at the black end; the relative term keeps them
 * proportionate everywhere else, which is what makes one function serve both
 * the near-black canvas and a lit panel sitting on it.
 *
 * @param steps positive raises (lighter), negative lowers (darker).
 */
export function elevate(hex: string, steps: number): string {
  const { r, g, b } = parseHex(hex);
  const direction = steps >= 0 ? 1 : -1;
  const count = Math.abs(Math.round(steps));

  const shiftChannel = (start: number): number => {
    let value = start;
    for (let i = 0; i < count; i++) {
      const delta = Math.max(LUMINANCE_FLOOR, value * LUMINANCE_STEP);
      value = Math.min(255, Math.max(0, value + delta * direction));
    }
    return value;
  };

  return toHex({ r: shiftChannel(r), g: shiftChannel(g), b: shiftChannel(b) });
}

/** Elevation levels, and what each one means. Shadow depth follows the same scale. */
export type Elevation = 0 | 1 | 2 | 3;

export interface SurfaceToken {
  readonly elevation: Elevation;
  readonly background: string;
  readonly border: string;
  /** CSS `box-shadow`. Offset and blur both grow with elevation. */
  readonly shadow: string;
}

export function surface(elevation: Elevation, base = CANVAS_BASE): SurfaceToken {
  const offset = elevation * 2;
  const blur = elevation * 6 + 2;
  const alpha = 0.28 + elevation * 0.12;
  return {
    elevation,
    background: elevate(base, elevation),
    border: elevate(base, elevation + 2),
    shadow: elevation === 0 ? "none" : `0 ${offset}px ${blur}px rgba(0,0,0,${alpha.toFixed(2)})`,
  };
}

// ===========================================================================
// The three-state filter
// ===========================================================================

/**
 * How an element stands relative to the current filter.
 *
 * The states are not "on/off" but a signed *three*-way distinction, and the
 * third state carries real information: `neutral` means no filter is active,
 * while `out` means a filter is active and this element failed it. Collapsing
 * those two would make "nothing matched your filter" look identical to "no
 * filter", which is exactly when a user needs to be told the difference.
 */
export type FilterState =
  /** Matches the active filter. Lifted and lit. */
  | "in"
  /** A filter is active and this failed it. Dimmed, still legible, still there. */
  | "out"
  /** No filter is active. The standard schema. */
  | "neutral";

export interface FilterToken {
  readonly state: FilterState;
  readonly opacity: number;
  /** Elevation delta applied on top of the element's own. */
  readonly elevationDelta: number;
  /** Multiplier on the element's accent colour saturation. */
  readonly saturation: number;
  readonly cssClass: string;
}

/**
 * `out` is dimmed to 0.34 and desaturated, never hidden.
 *
 * Removing filtered-out nodes from the canvas would change the *layout*, and a
 * node graph whose geometry shifts when you type in a search box is
 * disorienting — you lose the spatial memory that is the whole reason for
 * putting the pipeline on a plane. 0.34 is low enough to recede completely at
 * a glance and high enough that a card's shape and colour are still readable
 * when looked at directly.
 */
export const FILTER_TOKENS: Readonly<Record<FilterState, FilterToken>> = {
  in: { state: "in", opacity: 1, elevationDelta: 1, saturation: 1.15, cssClass: "f-in" },
  out: { state: "out", opacity: 0.34, elevationDelta: -1, saturation: 0.35, cssClass: "f-out" },
  neutral: {
    state: "neutral",
    opacity: 1,
    elevationDelta: 0,
    saturation: 1,
    cssClass: "f-neutral",
  },
};

/** Resolve an element's filter state from a predicate result. */
export const filterState = (filterActive: boolean, matches: boolean): FilterState =>
  !filterActive ? "neutral" : matches ? "in" : "out";

// ===========================================================================
// Provenance
// ===========================================================================

/**
 * Authorship colours, taken unchanged from the restorer's existing scheme:
 * cyan is the user, violet is the model. Reusing the exact hues means a person
 * moving between the grading desk and the blueprint canvas does not have to
 * learn a second colour language for the same idea.
 */
export const ACTOR_COLOUR = {
  user: "#4da3d8",
  ai: "#9b8cd4",
  system: "#6a6a78",
} as const;

/**
 * An AI-authored value is underlined until a user confirms it.
 *
 * The underline is the *unreviewed* marker, not the *AI* marker — a machine
 * suggestion a person has accepted becomes a person's decision and loses it.
 * Without that distinction, a canvas that has been fully reviewed still looks
 * provisional, and the marker stops meaning anything.
 */
export interface ProvenanceToken {
  readonly actor: keyof typeof ACTOR_COLOUR;
  readonly colour: string;
  readonly underline: boolean;
  readonly title: string;
}

export function provenance(
  actor: keyof typeof ACTOR_COLOUR,
  confirmed: boolean,
): ProvenanceToken {
  return {
    actor,
    colour: ACTOR_COLOUR[actor],
    underline: actor === "ai" && !confirmed,
    title: actor === "ai"
      ? (confirmed
        ? "Suggested by the model, confirmed by you"
        : "Suggested by the model — not yet reviewed")
      : actor === "user"
      ? "Your decision"
      : "Set automatically from measurement",
  };
}

// ===========================================================================
// Stylesheet generation
// ===========================================================================

/**
 * Emit the CSS these tokens imply.
 *
 * Generated rather than hand-written so that the stylesheet cannot disagree
 * with the types. `codegen` writes this to `ui/public/tokens.css`, and the
 * verify task fails if the file on disk differs from what this produces.
 */
export function emitCss(): string {
  const lines: string[] = [
    "/* GENERATED by core/tokens.ts — do not edit. Run `deno task codegen`. */",
    ":root {",
    `  --canvas: ${CANVAS_BASE};`,
  ];
  for (const level of [0, 1, 2, 3] as const) {
    const s = surface(level);
    lines.push(
      `  --surface-${level}: ${s.background};`,
      `  --border-${level}: ${s.border};`,
      `  --shadow-${level}: ${s.shadow};`,
    );
  }
  for (const [actor, colour] of Object.entries(ACTOR_COLOUR)) {
    lines.push(`  --actor-${actor}: ${colour};`);
  }
  lines.push("}", "");

  for (const token of Object.values(TYPE_TOKENS)) {
    lines.push(
      `.${token.cssClass} {`,
      `  font-family: ${token.fontFamily};`,
      `  font-weight: ${token.fontWeight};`,
      `  letter-spacing: ${token.letterSpacing}em;`,
      `  user-select: ${token.selectable ? "text" : "none"};`,
      "}",
      "",
    );
  }

  for (const token of Object.values(FILTER_TOKENS)) {
    lines.push(
      `.${token.cssClass} {`,
      `  opacity: ${token.opacity};`,
      `  filter: saturate(${token.saturation});`,
      "  transition: opacity 140ms ease, filter 140ms ease, transform 140ms ease;",
      "}",
      "",
    );
  }
  return lines.join("\n");
}
