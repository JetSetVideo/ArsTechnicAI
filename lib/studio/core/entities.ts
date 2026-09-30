/**
 * entities.ts — the people, places and things a project keeps.
 *
 * A reference card says how a film was photographed. It cannot say who your
 * grandmother was, what her kitchen looked like, or that the dog is missing an
 * ear — and those are the facts a restoration or a generated shot has to stay
 * faithful to across a hundred prompts. An **entity** is that: a named subject
 * with a description in the user's own words, the traits that must not drift,
 * and whatever material they have — a drawing, a photograph, a clip they shot
 * on their phone.
 *
 * It is deliberately the same shape as a reference card where it matters:
 * `entityGrant` turns one into a `Grant`, so an entity drops onto the canvas
 * and feeds a Style exactly as `movie.blade_runner` does. The library says how
 * it is shot; the entity says who is in it.
 *
 * ## Rules
 *
 * - **Nothing is overwritten.** Every save is a new `entity.v{N}.json`, every
 *   drawing or upload a new file under `media/v{N}/` (see `bridge/entity_store.ts`).
 * - **Ids are derived from the name and never reused**, because a graph that
 *   points at `character.grandmother` must keep meaning her.
 * - **Media is referenced, never inlined.** A five-minute clip does not belong
 *   in a JSON document that is read on every page load.
 */

import type { Grant } from "./library.ts";

export type EntityKind = "character" | "place" | "prop";

export const ENTITY_KINDS: readonly EntityKind[] = ["character", "place", "prop"];

export const KIND_LABEL: Readonly<Record<EntityKind, string>> = {
  character: "Character",
  place: "Place",
  prop: "Object",
};

/** How a piece of material came to be attached. */
export type MediaKind = "drawing" | "image" | "video" | "audio" | "document";

export interface EntityMedia {
  readonly id: string;
  readonly kind: MediaKind;
  /** Path relative to the workspace, as written by the store. */
  readonly path: string;
  readonly caption?: string;
  readonly addedAt: number;
  readonly bytes?: number;
}

export interface Entity {
  readonly id: string;
  readonly kind: EntityKind;
  readonly name: string;
  /** One line: who or what this is. */
  readonly summary: string;
  /** The user's own words, as long as they like. */
  readonly description: string;
  /**
   * Short facts that must not drift between generations — "left-handed",
   * "burn scar on the right hand", "always in the blue coat". These are what a
   * prompt repeats verbatim.
   */
  readonly traits: readonly string[];
  /** Reference card ids this subject is associated with, if any. */
  readonly references: readonly string[];
  readonly media: readonly EntityMedia[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface EntityDraft {
  readonly kind: EntityKind;
  readonly name: string;
  readonly summary?: string;
  readonly description?: string;
  readonly traits?: readonly string[];
  readonly references?: readonly string[];
}

const MAX_NAME = 80;
const MAX_SUMMARY = 200;
const MAX_DESCRIPTION = 8000;
const MAX_TRAITS = 24;
const MAX_TRAIT = 120;

/** A filesystem- and graph-safe id derived from the kind and name. */
export function entityId(kind: EntityKind, name: string, now = Date.now()): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "untitled";
  // The suffix keeps two people called "Marie" apart without asking the user
  // to invent unique names.
  return `${kind}.${slug}-${now.toString(36).slice(-5)}`;
}

/** Problems with a draft, as sentences. Empty means it can be saved. */
export function validateDraft(draft: unknown): string[] {
  const problems: string[] = [];
  if (typeof draft !== "object" || draft === null) return ["Not an entity."];
  const d = draft as Record<string, unknown>;

  if (!ENTITY_KINDS.includes(d.kind as EntityKind)) {
    problems.push(`kind must be one of ${ENTITY_KINDS.join(", ")}.`);
  }
  const name = typeof d.name === "string" ? d.name.trim() : "";
  if (name === "") problems.push("A name is required — it is how the graph refers to this.");
  if (name.length > MAX_NAME) problems.push(`The name is longer than ${MAX_NAME} characters.`);
  if (typeof d.summary === "string" && d.summary.length > MAX_SUMMARY) {
    problems.push(`The summary is longer than ${MAX_SUMMARY} characters.`);
  }
  if (typeof d.description === "string" && d.description.length > MAX_DESCRIPTION) {
    problems.push(`The description is longer than ${MAX_DESCRIPTION} characters.`);
  }
  if (d.traits !== undefined) {
    if (!Array.isArray(d.traits)) problems.push("traits must be a list.");
    else {
      if (d.traits.length > MAX_TRAITS) problems.push(`No more than ${MAX_TRAITS} traits.`);
      if (d.traits.some((t) => typeof t !== "string" || t.length > MAX_TRAIT)) {
        problems.push(`Each trait is a string of at most ${MAX_TRAIT} characters.`);
      }
    }
  }
  return problems;
}

/** Build a stored entity from a draft. Ids and timestamps are assigned here. */
export function createEntity(draft: EntityDraft, now = Date.now()): Entity {
  return {
    id: entityId(draft.kind, draft.name, now),
    kind: draft.kind,
    name: draft.name.trim(),
    summary: (draft.summary ?? "").trim(),
    description: (draft.description ?? "").trim(),
    traits: (draft.traits ?? []).map((t) => t.trim()).filter(Boolean),
    references: [...(draft.references ?? [])],
    media: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Apply an edit. The id, creation time and media list are not editable here. */
export function applyEdit(entity: Entity, draft: EntityDraft, now = Date.now()): Entity {
  return {
    ...entity,
    kind: draft.kind ?? entity.kind,
    name: (draft.name ?? entity.name).trim(),
    summary: (draft.summary ?? entity.summary).trim(),
    description: (draft.description ?? entity.description).trim(),
    traits: (draft.traits ?? entity.traits).map((t) => t.trim()).filter(Boolean),
    references: [...(draft.references ?? entity.references)],
    updatedAt: now,
  };
}

export function attachMedia(entity: Entity, media: EntityMedia): Entity {
  return { ...entity, media: [...entity.media, media], updatedAt: media.addedAt };
}

/**
 * What an entity grants to a prompt.
 *
 * The name leads because that is what the picture is *of*; traits follow in
 * the order they were written, because they are the facts that must survive;
 * the description follows as prose. Nothing here invents adjectives — a
 * generator that embellishes its subject is the thing this exists to prevent.
 */
export function entityGrant(entity: Entity): Grant {
  const lines: string[] = [];
  const subject = entity.kind === "place" ? entity.name : entity.name;
  if (entity.summary) lines.push(`${subject} — ${entity.summary}`);
  else lines.push(subject);
  for (const trait of entity.traits) lines.push(trait);
  if (entity.description) {
    // One paragraph, not the whole essay: a prompt is not a biography.
    const first = entity.description.split(/\n\s*\n/)[0]!.trim();
    if (first && first !== entity.summary) lines.push(first);
  }
  return {
    prompt: lines,
    params: {
      entity_id: entity.id,
      entity_kind: entity.kind,
      ...(entity.media.length > 0 ? { entity_media: entity.media.length } : {}),
    },
  };
}

/** The picture a card should show for this entity, if it has one. */
export function entityThumb(entity: Entity): string | null {
  const visual = entity.media.find((m) => m.kind === "drawing" || m.kind === "image");
  return visual ? `/workspace-media/${visual.path}` : null;
}

/** One line for a list row. */
export function describeEntity(entity: Entity): string {
  const bits = [KIND_LABEL[entity.kind]];
  if (entity.traits.length > 0) bits.push(`${entity.traits.length} traits`);
  if (entity.media.length > 0) bits.push(`${entity.media.length} media`);
  return bits.join(" · ");
}
