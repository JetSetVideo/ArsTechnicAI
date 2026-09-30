/**
 * library.ts — read `library/` off disk and hand `core/` something to index.
 *
 * The seam between the data and the pure layer. `core/library.ts` and
 * `core/cinema/` never touch the filesystem, so that they run identically in
 * the browser bundle, in a test and here; this module is the one place that
 * knows `library/` is a directory.
 *
 * ## Why the library is read rather than compiled in
 *
 * Bundling 160 reference cards and 150 KB of preset JSON into `wiv.js` would
 * work and would be simpler. It is not done, for two reasons that turned out
 * to matter more than the simplicity:
 *
 *   1. **The library is meant to grow.** Adding a film, a comic idiom or a
 *      scene form should be editing one JSON file, not editing a file and then
 *      remembering to rebuild the bundle. A contributor who does the first and
 *      not the second gets a card that silently does not exist.
 *   2. **Thumbnails have to be served anyway.** Once `/library/thumbs/...` is a
 *      route, `/api/library` costs nothing extra, and the canvas can show the
 *      shelves before the cinema data has finished parsing.
 *
 * The cost is a load failure mode, which `loadLibrary` handles by *reporting*
 * rather than throwing: a malformed shelf file loses that shelf, names itself
 * in `problems`, and leaves the other 140 cards on screen. A library that
 * refuses to open because one comic entry has a trailing comma is worse than
 * one that opens and says so.
 */

import { host } from "../host.ts";
import { movieReferences, parseReferences, enrichReferences, ReferenceLibrary } from "../core/library.ts";
import type { Reference, ReferenceFile } from "../core/library.ts";
import { PresetIndex } from "../core/cinema/presets.ts";
import type {
  AnimationPreset,
  CinematographyStyle,
  FilmPreset,
  PresetMappings,
} from "../core/cinema/presets.ts";
import type { ValidationMessage } from "../core/cinema/config.ts";
import { CINEMA_VOCABULARIES } from "../gen/cinema_vocabulary.ts";
import {
  ANIMATION_MEDIUM_ALIASES,
  CAMERA_MANUFACTURER_BY_BODY,
  COLOR_TONE_ALIASES,
  COMPOSITION_ALIASES,
  LENS_FAMILY_ALIASES,
  LENS_MANUFACTURER_ALIASES,
  MOVEMENT_ALIASES,
  SHOT_SIZE_ALIASES,
  STYLE_DOMAIN_ALIASES,
} from "../gen/cinema_mappings.ts";
import { PANAVISION_CAMERA_BODIES, PANAVISION_LENS_FAMILIES } from "../gen/cinema_compat.ts";

/**
 * The generated tables, in the shape `core/` asks for.
 *
 * `applyFilmPreset` takes these as an argument rather than importing them, so a
 * test can hand it a deliberately impoverished table and watch the
 * `PRESET_FALLBACK_*` warnings fire — which is not something a module that
 * reaches for its own constants can be made to do.
 */
export const PRESET_MAPPINGS: PresetMappings = Object.freeze({
  cameraManufacturerByBody: CAMERA_MANUFACTURER_BY_BODY,
  lensManufacturerAliases: LENS_MANUFACTURER_ALIASES,
  lensFamilyAliases: LENS_FAMILY_ALIASES,
  movementAliases: MOVEMENT_ALIASES,
  shotSizeAliases: SHOT_SIZE_ALIASES,
  compositionAliases: COMPOSITION_ALIASES,
  colorToneAliases: COLOR_TONE_ALIASES,
  styleDomainAliases: STYLE_DOMAIN_ALIASES,
  animationMediumAliases: ANIMATION_MEDIUM_ALIASES,
  panavisionBodies: [...PANAVISION_CAMERA_BODIES],
  panavisionLenses: [...PANAVISION_LENS_FAMILIES],
});

/** Where the library lives. `ARS_LIBRARY_ROOT` moves it, for a packaged build. */
export function libraryRoot(): string {
  return host.env.get("ARS_LIBRARY_ROOT") ??
    new URL("../library", import.meta.url).pathname;
}

export interface LoadedLibrary {
  readonly presets: PresetIndex;
  readonly references: ReferenceLibrary;
  /**
   * What could not be read, and why. Never empty on a broken install, never
   * thrown: the canvas shows these in the library panel rather than failing to
   * open.
   */
  readonly problems: readonly string[];
  /**
   * Terms a preset used that the vocabulary could not resolve.
   *
   * Separate from `problems`: a fallback is not a broken install, it is a
   * preset whose author wrote `Slow_Creep` where the vocabulary has no such
   * movement. The card still works and is still worth showing; this is how the
   * library says which fields quietly took a default.
   */
  readonly presetWarnings: readonly ValidationMessage[];
}

async function readJson<T>(path: string, problems: string[], what: string): Promise<T | null> {
  try {
    return JSON.parse(await host.readTextFile(path)) as T;
  } catch (error) {
    problems.push(`${what}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Load the whole library.
 *
 * Thumbnail existence is resolved *here*, by listing the directory once,
 * rather than by letting each card assume its frame is present. 109 of the 110
 * presets have a reference frame; the one that does not would otherwise render
 * a broken image, which reads as a bug rather than as an absence.
 */
export async function loadLibrary(root = libraryRoot()): Promise<LoadedLibrary> {
  const problems: string[] = [];

  const liveAction = await readJson<Record<string, FilmPreset>>(
    `${root}/cinema/live-action.json`,
    problems,
    "cinema/live-action.json",
  );
  const animation = await readJson<Record<string, AnimationPreset>>(
    `${root}/cinema/animation.json`,
    problems,
    "cinema/animation.json",
  );
  const cinematography = await readJson<Record<string, CinematographyStyle>>(
    `${root}/cinema/cinematography.json`,
    problems,
    "cinema/cinematography.json",
  );

  const presets = new PresetIndex({
    liveAction: liveAction ?? {},
    animation: animation ?? {},
    cinematography: cinematography ?? {},
  });

  const thumbs = new Set<string>();
  try {
    for await (const entry of host.readDir(`${root}/thumbs/movies`)) {
      if (entry.isFile && entry.name.endsWith(".jpg")) {
        thumbs.add(entry.name.slice(0, -4));
      }
    }
  } catch {
    problems.push("thumbs/movies is unreadable — movie cards will render without frames");
  }

  const movies = movieReferences(
    presets,
    CINEMA_VOCABULARIES,
    PRESET_MAPPINGS,
    (id) => thumbs.has(id),
  );
  const references: Reference[] = [...movies.references];

  // Shelves are discovered rather than listed, so dropping in a new
  // `references/*.json` is all it takes to add a category's worth of cards.
  try {
    const files: string[] = [];
    for await (const entry of host.readDir(`${root}/references`)) {
      if (entry.isFile && entry.name.endsWith(".json")) files.push(entry.name);
    }
    files.sort();
    for (const name of files) {
      const shelf = await readJson<ReferenceFile>(
        `${root}/references/${name}`,
        problems,
        `references/${name}`,
      );
      if (!shelf) continue;
      try {
        references.push(...parseReferences(shelf));
      } catch (error) {
        problems.push(
          `references/${name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  } catch (error) {
    problems.push(
      `references/ is unreadable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // A duplicate id is a construction error in `ReferenceLibrary`, and it is a
  // real risk once shelves are user-supplied. Catch it into `problems` and
  // drop the later card rather than losing the entire library to one typo.
  let library: ReferenceLibrary;
  try {
    library = new ReferenceLibrary(references);
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
    const seen = new Set<string>();
    library = new ReferenceLibrary(
      references.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true))),
    );
  }

  return { presets, references: library, problems, presetWarnings: movies.warnings };
}

/**
 * The wire form the canvas fetches.
 *
 * Deliberately not the `Reference` objects with their grants inlined twice —
 * a movie card's grant carries a whole `CinemaConfig`, and 110 of those is
 * most of the payload. The canvas gets everything, because it needs the grant
 * to build a node, but the shape is stated here so the route and the client
 * agree on one thing rather than two.
 */
export interface LibraryPayload {
  readonly references: readonly Reference[];
  readonly counts: Readonly<Record<string, number>>;
  readonly problems: readonly string[];
  readonly presetWarnings: readonly ValidationMessage[];
  readonly cinema: {
    readonly films: number;
    readonly styles: number;
  };
}

export function toPayload(loaded: LoadedLibrary): LibraryPayload {
  return {
    references: enrichReferences(loaded.references.all()),
    counts: loaded.references.counts(),
    problems: loaded.problems,
    presetWarnings: loaded.presetWarnings,
    cinema: {
      films: loaded.presets.films().length,
      styles: loaded.presets.styles().length,
    },
  };
}
