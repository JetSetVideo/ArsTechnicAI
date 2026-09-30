/**
 * library.ts — the examples, and what dropping one on the canvas means.
 *
 * A **reference** is a worked example you can put in a blueprint: a film, a
 * casting archetype, a comic-book idiom, a scene from a script. It is the
 * answer to the blank-canvas problem — the same reason the Workshop opens on a
 * seeded chain rather than an empty plane. Nobody's first useful thought is
 * "Panavision Panaflex, Eastman 5293, C-Series at 50mm"; it is "like Blade
 * Runner", and the library is what turns the second into the first.
 *
 * ## What a reference actually is
 *
 * Not a prompt fragment. A reference **grants** structured material to the
 * node it feeds:
 *
 *   - a `CinemaConfig` — body, glass, stock, light, era: the whole shot spec,
 *     which `core/cinema/rules.ts` can then have an opinion about;
 *   - prompt text and negative terms, for the parts a config cannot carry;
 *   - free parameters, for anything model-specific.
 *
 * That is the difference between "in the style of X" and having X's grammar.
 * A grant is *structured*, so two references can be combined and the conflict
 * is visible — a 1940s film preset next to an LED-lit archetype produces a
 * rule violation, not a muddled sentence.
 *
 * ## The four kinds, and why these four
 *
 * | kind      | answers                                    |
 * | --------- | ------------------------------------------ |
 * | `movie`   | how is it *photographed*                   |
 * | `star`    | who is in front of the lens, and how they play it |
 * | `comic`   | how is it *drawn* — line, colour, panel     |
 * | `script`  | what *happens*, and in what shape           |
 *
 * They are orthogonal on purpose: one of each composes into a complete shot,
 * and the canvas can wire all four into a single generate node.
 *
 * ## Likeness
 *
 * `star` references describe **casting and performance** — archetype, register,
 * wardrobe, the light the persona is conventionally shot in. They deliberately
 * do not describe the face of a real person. A reference library whose purpose
 * was to reproduce identifiable people would be a likeness-rights problem
 * wearing a cinematography hat, and it would also be the less useful tool:
 * what a shot needs is a *presence*, and presence is a lighting and blocking
 * decision. Real people appear in this library as attribution — the
 * cinematographers credited in `library/cinema/cinematography.json` — never as
 * a target to reproduce.
 *
 * [AGENT-VOCABULARY] `core/` stays pure: this file declares shapes and queries
 * them. Reading `library/` off disk is `server.ts`'s job, and fetching it is
 * the browser's. That is also what makes the library extensible without a
 * rebuild — a new film is a new JSON entry.
 */

import type { CinemaConfig, ValidationMessage } from "./cinema/config.ts";
import type { PresetIndex, PresetMappings } from "./cinema/presets.ts";
import { applyAnimationPreset, applyFilmPreset, withAnamorphicFlag } from "./cinema/presets.ts";

// ---------------------------------------------------------------------------
// The ontology
// ---------------------------------------------------------------------------

export type ReferenceKind = "movie" | "star" | "comic" | "script";

export const REFERENCE_KINDS: readonly ReferenceKind[] = Object.freeze([
  "movie",
  "star",
  "comic",
  "script",
]);

/** Accent per kind. Cards, chips and the library tab all read from here. */
export const KIND_COLOUR: Readonly<Record<ReferenceKind, string>> = Object.freeze({
  movie: "#4da3d8",
  star: "#e8a33d",
  comic: "#c76a9f",
  script: "#5cbfa8",
});

/**
 * What a reference contributes when it is wired into a generate node.
 *
 * Every field is optional and they compose by *merging*, not overwriting:
 * `mergeGrants` concatenates the text and unions the parameters, so a movie
 * and an archetype together produce more specification than either alone. The
 * `cinema` config is the exception — two configs cannot be averaged, so the
 * last one wins and `mergeGrants` records that it happened.
 */
export interface Grant {
  /** A complete shot specification. The rules engine can validate this. */
  readonly cinema?: CinemaConfig;
  /** Text to add to the positive prompt, in order. */
  readonly prompt?: readonly string[];
  /** Text to add to the negative prompt. */
  readonly negative?: readonly string[];
  /** Free parameters for the target model — LoRA names, guidance, seeds. */
  readonly params?: Readonly<Record<string, string | number | boolean>>;
}

/** A neighbour on the Home overlay — id is enough; name/kind are filled on the wire. */
export interface RelatedRef {
  readonly id: string;
  readonly name?: string;
  readonly kind?: ReferenceKind;
}

/**
 * Facts the Home overlay can paint without guessing.
 *
 * Every field is optional. JSON shelves may author them; movies mostly inherit
 * them from the cinema preset. `enrichReferences` fills holes from existing
 * fields (`year` → `when`, `summary` → `why`, grant prompt → `how`) and
 * resolves `related` against the rest of the catalogue. Never a reason to
 * drop `summary`, `tags`, `grant` or `detail`.
 */
export interface ReferenceOverlay {
  readonly where?: string;
  readonly when?: string;
  readonly why?: string;
  readonly how?: string;
  readonly characters?: readonly string[];
  readonly actors?: readonly string[];
  readonly studio?: string;
  /** Display length — `"117 min"`, `"8–64 pages"`, `"mm:ss"`. */
  readonly length?: string;
  readonly score?: number;
  readonly related?: readonly RelatedRef[];
}

export interface Reference extends ReferenceOverlay {
  readonly id: string;
  readonly kind: ReferenceKind;
  readonly name: string;
  /** One line. What this is and when to reach for it. */
  readonly summary: string;
  /** Free tags for search and filtering — era, genre, medium, mood. */
  readonly tags: readonly string[];
  /** Year, where the reference has one. Sorts the movie shelf. */
  readonly year?: number;
  /** Path under `/library/`, served by the canvas host. */
  readonly thumb?: string;
  /** Where this came from, so a claim in a card is traceable. */
  readonly source?: string;
  readonly grant: Grant;
  /**
   * Longer prose, shown when a card is opened. For a movie this is the
   * cinematography note; for a script it is the scene itself.
   */
  readonly detail?: string;
}

// ---------------------------------------------------------------------------
// Combining
// ---------------------------------------------------------------------------

/**
 * Merge grants left to right.
 *
 * Prompt and negative fragments concatenate in order, deduped — two references
 * that both ask for "anamorphic flare" should say it once, because repetition
 * is a weighting signal to several models and an accidental double weight is a
 * silent quality change.
 *
 * Only one `cinema` config can survive. Rather than pick quietly, the result
 * reports which references supplied one, so a card can say "Blade Runner's
 * camera, overridden by Akira's" instead of the user discovering it in the
 * output.
 */
export function mergeGrants(
  grants: ReadonlyArray<{ id: string; grant: Grant }>,
): { grant: Grant; cinemaFrom: readonly string[] } {
  const prompt: string[] = [];
  const negative: string[] = [];
  const params: Record<string, string | number | boolean> = {};
  const cinemaFrom: string[] = [];
  let cinema: CinemaConfig | undefined;

  for (const { id, grant } of grants) {
    for (const line of grant.prompt ?? []) {
      if (!prompt.includes(line)) prompt.push(line);
    }
    for (const line of grant.negative ?? []) {
      if (!negative.includes(line)) negative.push(line);
    }
    Object.assign(params, grant.params ?? {});
    if (grant.cinema) {
      cinema = grant.cinema;
      cinemaFrom.push(id);
    }
  }

  const merged: Grant = {
    ...(cinema ? { cinema } : {}),
    ...(prompt.length > 0 ? { prompt } : {}),
    ...(negative.length > 0 ? { negative } : {}),
    ...(Object.keys(params).length > 0 ? { params } : {}),
  };
  return { grant: merged, cinemaFrom };
}

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

/**
 * Every reference, indexed and searchable.
 *
 * Search is substring over name, summary and tags, lower-cased — deliberately
 * not fuzzy. A user typing "noir" wants the noir shelf, and a fuzzy matcher
 * that also returns "Nosferatu" because the letters are close is worse than
 * one that returns nothing and lets them try again.
 */
export class ReferenceLibrary {
  readonly #byId: ReadonlyMap<string, Reference>;
  readonly #byKind: ReadonlyMap<ReferenceKind, readonly Reference[]>;

  constructor(references: readonly Reference[]) {
    const byId = new Map<string, Reference>();
    for (const reference of references) {
      if (byId.has(reference.id)) {
        throw new Error(
          `Duplicate reference id: ${reference.id}. Ids are how a saved graph finds its ` +
            "references again, so two cards cannot share one.",
        );
      }
      byId.set(reference.id, reference);
    }
    this.#byId = byId;

    const byKind = new Map<ReferenceKind, Reference[]>();
    for (const kind of REFERENCE_KINDS) byKind.set(kind, []);
    for (const reference of byId.values()) byKind.get(reference.kind)?.push(reference);
    this.#byKind = byKind;
  }

  static empty(): ReferenceLibrary {
    return new ReferenceLibrary([]);
  }

  get(id: string): Reference | null {
    return this.#byId.get(id) ?? null;
  }

  all(): readonly Reference[] {
    return [...this.#byId.values()];
  }

  byKind(kind: ReferenceKind): readonly Reference[] {
    return this.#byKind.get(kind) ?? [];
  }

  counts(): Readonly<Record<ReferenceKind, number>> {
    const out = {} as Record<ReferenceKind, number>;
    for (const kind of REFERENCE_KINDS) out[kind] = this.byKind(kind).length;
    return out;
  }

  search(query: string, kind?: ReferenceKind): readonly Reference[] {
    const needle = query.trim().toLowerCase();
    const pool = kind ? this.byKind(kind) : this.all();
    if (needle === "") return pool;
    return pool.filter((r) =>
      r.name.toLowerCase().includes(needle) ||
      r.summary.toLowerCase().includes(needle) ||
      r.tags.some((t) => t.toLowerCase().includes(needle)) ||
      (r.when?.toLowerCase().includes(needle) ?? false) ||
      (r.where?.toLowerCase().includes(needle) ?? false) ||
      (r.why?.toLowerCase().includes(needle) ?? false) ||
      (r.how?.toLowerCase().includes(needle) ?? false) ||
      (r.studio?.toLowerCase().includes(needle) ?? false)
    );
  }

  get size(): number {
    return this.#byId.size;
  }
}

// ---------------------------------------------------------------------------
// Overlay derivation
// ---------------------------------------------------------------------------

const PLACE_TAGS = new Set([
  "urban",
  "interior",
  "exterior",
  "western",
  "american",
  "european",
  "japanese",
  "korean",
  "british",
  "chamber",
  "chamber-drama",
  "institutional",
  "franco-belgian",
]);

function humanizeToken(value: string): string {
  return value.replaceAll("_", " ");
}

function joinBits(
  parts: readonly (string | number | undefined)[],
  sep = " · ",
): string | undefined {
  const bits = parts
    .map((p) => (typeof p === "number" && Number.isFinite(p) ? String(p) : typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  return bits.length > 0 ? bits.join(sep) : undefined;
}

export function formatOverlayLength(value: string | number | undefined): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return `${value} min`;
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return undefined;
}

function nonEmptyList(values: readonly string[] | undefined): readonly string[] | undefined {
  if (!values) return undefined;
  const out = values.map((v) => v.trim()).filter(Boolean);
  return out.length > 0 ? out : undefined;
}

export function parseRelated(raw: unknown): readonly RelatedRef[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: RelatedRef[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim() !== "") {
      out.push({ id: item.trim() });
      continue;
    }
    if (item && typeof item === "object" && "id" in item) {
      const rec = item as { id?: unknown; name?: unknown; kind?: unknown };
      if (typeof rec.id !== "string" || rec.id.trim() === "") continue;
      out.push({
        id: rec.id.trim(),
        ...(typeof rec.name === "string" ? { name: rec.name } : {}),
        ...(typeof rec.kind === "string" &&
            (REFERENCE_KINDS as readonly string[]).includes(rec.kind)
          ? { kind: rec.kind as ReferenceKind }
          : {}),
      });
    }
  }
  return out.length > 0 ? out : undefined;
}

type OverlayDraft = {
  [K in keyof ReferenceOverlay]?: ReferenceOverlay[K] | undefined;
};

function overlaySpread(overlay: OverlayDraft): ReferenceOverlay {
  const characters = nonEmptyList(overlay.characters);
  const actors = nonEmptyList(overlay.actors);
  const related = overlay.related && overlay.related.length > 0 ? overlay.related : undefined;
  return {
    ...(overlay.where ? { where: overlay.where } : {}),
    ...(overlay.when ? { when: overlay.when } : {}),
    ...(overlay.why ? { why: overlay.why } : {}),
    ...(overlay.how ? { how: overlay.how } : {}),
    ...(characters ? { characters } : {}),
    ...(actors ? { actors } : {}),
    ...(overlay.studio ? { studio: overlay.studio } : {}),
    ...(overlay.length ? { length: overlay.length } : {}),
    ...(typeof overlay.score === "number" && Number.isFinite(overlay.score)
      ? { score: overlay.score }
      : {}),
    ...(related ? { related } : {}),
  };
}

function whereFromTags(tags: readonly string[]): string | undefined {
  const hits = tags.filter((t) => PLACE_TAGS.has(t.toLowerCase()));
  return hits.length > 0 ? hits.join(" · ") : undefined;
}

/**
 * Resolve `related` ids against the catalogue and fill any overlay hole from
 * fields the card already has. Explicit JSON always wins.
 */
export function enrichReferences(refs: readonly Reference[]): readonly Reference[] {
  const byId = new Map(refs.map((r) => [r.id, r]));
  return refs.map((ref) => {
    const derived = overlaySpread({
      where: ref.where ?? whereFromTags(ref.tags),
      when: ref.when ?? (ref.year !== undefined ? String(ref.year) : undefined),
      why: ref.why ?? ref.summary,
      how: ref.how ?? ref.grant.prompt?.[0],
      characters: ref.characters,
      actors: ref.actors,
      studio: ref.studio,
      length: ref.length,
      score: ref.score,
      related: ref.related,
    });
    const related = resolveRelated(ref, refs, byId);
    return { ...ref, ...derived, ...(related ? { related } : {}) };
  });
}

function resolveRelated(
  ref: Reference,
  all: readonly Reference[],
  byId: ReadonlyMap<string, Reference>,
): readonly RelatedRef[] | undefined {
  const authored = ref.related ?? [];
  const inferred = authored.length > 0 ? authored : inferRelated(ref, all);
  if (inferred.length === 0) return undefined;
  const seen = new Set<string>();
  const out: RelatedRef[] = [];
  for (const item of inferred) {
    if (item.id === ref.id || seen.has(item.id)) continue;
    seen.add(item.id);
    const hit = byId.get(item.id);
    out.push(
      hit
        ? { id: hit.id, name: hit.name, kind: hit.kind }
        : item,
    );
    if (out.length >= 6) break;
  }
  return out.length > 0 ? out : undefined;
}

function inferRelated(ref: Reference, all: readonly Reference[]): readonly RelatedRef[] {
  const tagged = all.filter((other) => {
    if (other.id === ref.id || other.kind !== ref.kind) return false;
    const overlap = other.tags.filter((t) => ref.tags.includes(t)).length;
    if (overlap >= 2) return true;
    if (ref.kind === "movie" && ref.year && other.year) {
      return Math.abs(ref.year - other.year) <= 8 && overlap >= 1;
    }
    return false;
  });
  tagged.sort((a, b) => a.id.localeCompare(b.id));
  return tagged.slice(0, 4).map((r) => ({ id: r.id, name: r.name, kind: r.kind }));
}

// ---------------------------------------------------------------------------
// Movies, derived from the cinema presets
// ---------------------------------------------------------------------------

/**
 * Turn the cinema presets into reference cards.
 *
 * Derived rather than duplicated into a second JSON file: the presets already
 * hold the whole specification, and a `movies.json` beside them would be a
 * copy that rots the first time someone widens a film's lens list. The cost is
 * that a movie card cannot carry anything the preset schema has no room for —
 * which has not been a real constraint, because the cinematography record
 * supplies the prose.
 *
 * `thumbAvailable` is passed in rather than probed: `core/` cannot touch the
 * filesystem, and a card that points at a missing frame renders a broken image
 * rather than falling back to its type colour.
 */
export function movieReferences(
  presets: PresetIndex,
  vocabulary: Readonly<Record<string, readonly string[]>>,
  mappings: PresetMappings,
  thumbAvailable: (id: string) => boolean = () => true,
): { references: readonly Reference[]; warnings: readonly ValidationMessage[] } {
  const out: Reference[] = [];
  const warnings: ValidationMessage[] = [];

  for (const film of presets.films()) {
    const style = presets.cinematography(film.id);
    const detail = style
      ? [
        `Cinematographer: ${style.cinematographer}`,
        `Camera: ${style.camera}`,
        `Stock: ${style.film_stock}`,
        `Aspect: ${style.aspect_ratio}`,
        `Lighting: ${style.lighting_signature}`,
        `Palette: ${style.color_palette}`,
        `Lenses: ${style.lens_info}`,
        `Movement: ${style.movement_style}`,
        `Techniques: ${style.notable_techniques}`,
        ...(style.legacy ? [`Legacy: ${style.legacy}`] : []),
      ].join("\n")
      : undefined;

    // The prose lines are what a prompt actually wants to *say*; the config is
    // what the rules can check. A movie card grants both.
    const promptLines = style
      ? [style.lighting_signature, style.color_palette, style.notable_techniques]
      : [];

    const applied = applyFilmPreset(film, vocabulary, mappings);
    warnings.push(...applied.warnings);

    const summary = style
      ? `${film.year} · shot by ${style.cinematographer} · ${style.camera}`
      : `${film.year} · ${film.era}`;

    out.push({
      id: `movie.${film.id}`,
      kind: "movie",
      name: film.name,
      year: film.year,
      summary,
      tags: [film.era, ...film.mood, ...film.color_tone, ...film.lighting_style],
      ...(thumbAvailable(film.id) ? { thumb: `/library/thumbs/movies/${film.id}.jpg` } : {}),
      source: "Cinema Prompt Engineering preset library",
      grant: {
        cinema: withAnamorphicFlag(applied.config),
        ...(promptLines.length > 0 ? { prompt: promptLines } : {}),
      },
      ...(detail ? { detail } : {}),
      ...overlaySpread({
        where: film.where,
        when: joinBits([film.year, humanizeToken(film.era)]),
        why: film.why ?? style?.legacy ?? summary,
        how: film.how ??
          joinBits([
            style?.lighting_signature,
            style?.movement_style,
            style?.notable_techniques,
          ]) ??
          joinBits([...film.lighting_style, ...film.movement], ", "),
        characters: film.characters,
        actors: film.actors,
        studio: film.studio,
        length: formatOverlayLength(film.length),
        score: film.score,
        related: parseRelated(film.related),
      }),
    });
  }

  for (const style of presets.styles()) {
    const applied = applyAnimationPreset(style, vocabulary, mappings);
    warnings.push(...applied.warnings);

    const summary = `${style.domain} · ${style.medium} · ${style.reference_works[0] ?? "animation"}`;
    const relatedFromWorks = parseRelated(
      style.related?.length
        ? style.related
        : style.reference_works
          .map((w) => {
            const slug = w.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
            return `movie.${slug}`;
          })
          .filter((id) => id !== `movie.${style.id}`),
    );

    out.push({
      id: `movie.${style.id}`,
      kind: "movie",
      name: style.name,
      summary,
      tags: [style.domain, style.medium, ...style.mood, ...style.color_tone],
      ...(thumbAvailable(style.id) ? { thumb: `/library/thumbs/movies/${style.id}.jpg` } : {}),
      source: "Cinema Prompt Engineering preset library",
      grant: {
        cinema: applied.config,
        prompt: [
          `${style.line_treatment} linework`,
          `${style.color_application} colour`,
          `${style.surface_detail} surfaces`,
        ],
      },
      ...(style.reference_works.length > 0
        ? { detail: `Reference works: ${style.reference_works.join(", ")}` }
        : {}),
      ...overlaySpread({
        where: style.where ?? humanizeToken(style.domain),
        why: style.why ?? summary,
        how: style.how ??
          joinBits([
            `${style.line_treatment} linework`,
            `${style.color_application} colour`,
            `${style.motion_style} motion`,
          ]),
        characters: style.characters,
        actors: style.actors,
        studio: style.studio,
        length: formatOverlayLength(style.length),
        score: style.score,
        related: relatedFromWorks,
      }),
    });
  }

  return { references: out, warnings };
}

// ---------------------------------------------------------------------------
// Loading hand-authored shelves
// ---------------------------------------------------------------------------

/**
 * The JSON shape of `library/references/*.json`.
 *
 * Hand-written, so it is forgiving: everything but `id`, `name` and `summary`
 * may be omitted. `parseReferences` fills the rest, because a shelf entry that
 * fails to load is a card that silently does not appear, and a missing card is
 * much harder to notice than a sparse one.
 */
export interface ReferenceFile {
  readonly kind: ReferenceKind;
  readonly source?: string;
  readonly entries: readonly {
    id: string;
    name: string;
    summary: string;
    year?: number;
    tags?: string[];
    thumb?: string;
    detail?: string;
    where?: string;
    when?: string;
    why?: string;
    how?: string;
    characters?: string[];
    actors?: string[];
    studio?: string;
    length?: string | number;
    score?: number;
    related?: Array<string | RelatedRef>;
    grant?: {
      prompt?: string[];
      negative?: string[];
      params?: Record<string, string | number | boolean>;
    };
  }[];
}

/**
 * Turn one shelf file into references.
 *
 * Ids are namespaced by kind on the way in (`star.femme_fatale`), so two
 * shelves can use the same short id without colliding — and so a card's id
 * says what it is without a lookup.
 */
export function parseReferences(file: ReferenceFile): readonly Reference[] {
  return file.entries.map((entry) => {
    const tags = entry.tags ?? [];
    const overlay = overlaySpread({
      where: entry.where ?? whereFromTags(tags),
      when: entry.when ?? (entry.year !== undefined ? String(entry.year) : undefined),
      why: entry.why ?? entry.summary,
      how: entry.how ?? entry.grant?.prompt?.[0],
      characters: entry.characters ??
        (file.kind === "star" ? [entry.name] : undefined),
      actors: entry.actors,
      studio: entry.studio,
      length: formatOverlayLength(entry.length),
      score: entry.score,
      related: parseRelated(entry.related),
    });
    return {
      id: `${file.kind}.${entry.id}`,
      kind: file.kind,
      name: entry.name,
      summary: entry.summary,
      tags,
      ...(entry.year !== undefined ? { year: entry.year } : {}),
      ...(entry.thumb !== undefined ? { thumb: entry.thumb } : {}),
      ...(file.source !== undefined ? { source: file.source } : {}),
      ...(entry.detail !== undefined ? { detail: entry.detail } : {}),
      grant: {
        ...(entry.grant?.prompt ? { prompt: entry.grant.prompt } : {}),
        ...(entry.grant?.negative ? { negative: entry.grant.negative } : {}),
        ...(entry.grant?.params ? { params: entry.grant.params } : {}),
      },
      ...overlay,
    };
  });
}
