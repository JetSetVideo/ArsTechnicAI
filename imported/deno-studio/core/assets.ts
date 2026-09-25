/**
 * assets.ts — the asset ledger.
 *
 * ## What this is for
 *
 * A restoration graph produces a *result per node per run*. Without a ledger,
 * the only record of that is the picture currently painted on the card, which
 * the next run overwrites. You cannot then answer the three questions the work
 * actually raises: what did this node produce last time, what produced *this*,
 * and which of the four versions of this frame do I want to keep.
 *
 * `docs/MERGE_PLAN.md` §1.3 records where this vocabulary comes from — the
 * GitHub version's own architecture review, which audited its asset model and
 * named the four things it lacked. Three of them are fixed here by
 * construction:
 *
 *   - **asset-to-asset relations** are a first-class edge list, not a pair of
 *     id arrays, so lineage can be walked in both directions;
 *   - **soft delete** is the only delete — `retired` is a state, and a retired
 *     version stays in the ledger and stays replayable;
 *   - **change history** is the point of the whole file: a node keeps every
 *     version it has produced, in order.
 *
 * The fourth — an aggregation layer — is `summarise()`, computed once per
 * ledger revision rather than per render, which is the mistake the review
 * named ("recomputed ad-hoc in the client").
 *
 * ## Why this is not `core/lineage.ts`
 *
 * `LineageStore` tracks *buffers* — the pixels flowing through one evaluation,
 * with copy-on-write and a byte budget. This tracks *deliverables* — the
 * results a person would name, compare and keep, across runs and across
 * sessions. One is the memory of a computation; the other is the history of a
 * project. Merging them would give the byte budget the power to evict a
 * version somebody starred.
 */

import type { NodeId } from "./ids.ts";
import { digest as hashOf } from "./hash.ts";

// ===========================================================================
// Vocabulary
// ===========================================================================

/**
 * How one asset came to exist.
 *
 * Taken verbatim from the GitHub version's `source` field, which had the
 * distinctions right: the thing that matters is not the file type but whether
 * a human chose it, a model made it, or a graph derived it.
 */
export type AssetSource =
  /** Read off disk — the reel, a reference frame. */
  | "imported"
  /** Produced by a network model. Costs money; always gated. */
  | "generated"
  /** Derived from another asset by a local stage. The common case here. */
  | "remixed"
  /** An exact copy, kept to branch from without disturbing the original. */
  | "duplicated"
  /** Authored by hand — a mask drawn, a value set. */
  | "manual";

/**
 * How two assets relate.
 *
 * The relation types are the ones proposed in the donor's architecture review.
 * `VARIANT_OF` is the load-bearing one: two runs of the same node with
 * different parameters are siblings, not ancestor and descendant, and drawing
 * them as a chain would misrepresent the choice between them as a sequence.
 */
export type RelationType =
  | "derived_from"
  | "variant_of"
  | "used_in"
  | "references";

/** Where a version sits in its life. `retired` is as deleted as anything gets. */
export type AssetState = "draft" | "ready" | "failed" | "retired";

/** One result, from one node, from one run. */
export interface AssetVersion {
  readonly id: string;
  /** The node that produced it. */
  readonly node: NodeId;
  /** 1-based, per node. What the UI calls "v3". */
  readonly version: number;
  /** The frame this result is of. */
  readonly frame: number;
  readonly source: AssetSource;
  readonly state: AssetState;
  /**
   * Content address of the *parameters*, not the pixels.
   *
   * Hashing the image would be the obvious choice and is the wrong one: two
   * runs with identical parameters must collide so the ledger can say "this is
   * the same result again", and JPEG re-encoding makes identical inputs
   * produce different bytes. Hashing the request keeps the equality that
   * matters.
   */
  readonly digest: string;
  /** Milliseconds the engine took. Nullable: an import takes no time. */
  readonly elapsedMs: number;
  readonly widthPx: number;
  readonly heightPx: number;
  /** A data URL or engine path. Absent once compacted. */
  readonly image?: string;
  /** Whatever the engine reported — luminance, sharpness, score. */
  readonly report: Readonly<Record<string, unknown>>;
  readonly createdAt: number;
  /** Kept out of automatic compaction, and shown first. */
  readonly starred: boolean;
  readonly note?: string;
}

export interface AssetRelation {
  readonly from: string;
  readonly to: string;
  readonly type: RelationType;
}

export interface AssetLedger {
  readonly versions: readonly AssetVersion[];
  readonly relations: readonly AssetRelation[];
  readonly revision: number;
}

export const emptyLedger = (): AssetLedger => ({
  versions: [],
  relations: [],
  revision: 0,
});

// ===========================================================================
// Recording
// ===========================================================================

export interface RecordInput {
  readonly node: NodeId;
  readonly frame: number;
  readonly source: AssetSource;
  readonly params: Readonly<Record<string, unknown>>;
  readonly elapsedMs?: number;
  readonly widthPx?: number;
  readonly heightPx?: number;
  readonly image?: string;
  readonly report?: Readonly<Record<string, unknown>>;
  readonly state?: AssetState;
  /** Version ids this result was computed from — the upstream nodes' latest. */
  readonly parents?: readonly string[];
}

/** How many versions one node keeps before the oldest unstarred one is dropped. */
export const VERSIONS_PER_NODE = 12;

/**
 * Append a version, and the relations that place it.
 *
 * Returns the ledger unchanged when the digest matches the node's current
 * latest — re-running a node you did not edit is a no-op in the history, or a
 * scrub through a stack would bury every real decision under three hundred
 * identical entries.
 */
export function record(ledger: AssetLedger, input: RecordInput): AssetLedger {
  const digest = hashOf({
    node: input.node,
    frame: input.frame,
    params: input.params,
  }, "asset");

  const mine = ledger.versions.filter((v) => v.node === input.node);
  const latest = mine[mine.length - 1];
  if (latest && latest.digest === digest && latest.state !== "failed") {
    // Same request, same result: no new version. But the *parents* may be
    // newly known — a chain run end-first records the tail before its
    // upstream nodes have versions at all, and running them afterwards would
    // otherwise leave the tail permanently orphaned in the lineage. So the
    // dedupe keeps the version and still adopts links it did not have.
    const known = new Set(
      ledger.relations
        .filter((r) => r.from === latest.id && r.type === "derived_from")
        .map((r) => r.to),
    );
    const missing = (input.parents ?? []).filter((id) => !known.has(id) && id !== latest.id);
    if (missing.length === 0) return ledger;
    return {
      ...ledger,
      relations: [
        ...ledger.relations,
        ...missing.map((to) => ({ from: latest.id, to, type: "derived_from" as const })),
      ],
      revision: ledger.revision + 1,
    };
  }

  const version: AssetVersion = {
    id: `${input.node}:v${mine.length + 1}:${digest.slice(0, 8)}`,
    node: input.node,
    version: mine.length + 1,
    frame: input.frame,
    source: input.source,
    state: input.state ?? "ready",
    digest,
    elapsedMs: input.elapsedMs ?? 0,
    widthPx: input.widthPx ?? 0,
    heightPx: input.heightPx ?? 0,
    ...(input.image ? { image: input.image } : {}),
    report: input.report ?? {},
    createdAt: Date.now(),
    starred: false,
  };

  const relations: AssetRelation[] = [...ledger.relations];
  for (const parent of input.parents ?? []) {
    relations.push({ from: version.id, to: parent, type: "derived_from" });
  }
  // A new version of a node is a variant of the one before it. Recording that
  // explicitly means "show me the alternatives" is a relation query rather
  // than a special case over the version number.
  if (latest) {
    relations.push({ from: version.id, to: latest.id, type: "variant_of" });
  }

  return compact({
    versions: [...ledger.versions, version],
    relations,
    revision: ledger.revision + 1,
  });
}

/**
 * Drop the pixels of old versions, never the versions.
 *
 * Past `VERSIONS_PER_NODE`, the oldest unstarred versions of a node lose their
 * `image` but keep their digest, parameters-hash, report and relations — so
 * the history stays complete and the entry stays replayable, while a long
 * session stops growing without bound. This is the same trade `core/lineage.ts`
 * makes with `compact()`, for the same reason.
 */
function compact(ledger: AssetLedger): AssetLedger {
  const perNode = new Map<NodeId, AssetVersion[]>();
  for (const v of ledger.versions) {
    const list = perNode.get(v.node) ?? [];
    list.push(v);
    perNode.set(v.node, list);
  }

  const strip = new Set<string>();
  for (const list of perNode.values()) {
    const heavy = list.filter((v) => v.image && !v.starred);
    const excess = heavy.length - VERSIONS_PER_NODE;
    for (let i = 0; i < excess; i += 1) strip.add(heavy[i]!.id);
  }
  if (strip.size === 0) return ledger;

  return {
    ...ledger,
    versions: ledger.versions.map((v) => {
      if (!strip.has(v.id)) return v;
      const { image: _dropped, ...rest } = v;
      return rest;
    }),
  };
}

// ===========================================================================
// Queries
// ===========================================================================

/** Every version of one node, oldest first. */
export function historyOf(ledger: AssetLedger, node: NodeId): readonly AssetVersion[] {
  return ledger.versions.filter((v) => v.node === node);
}

/** The current result of a node, ignoring retired ones. */
export function latestOf(ledger: AssetLedger, node: NodeId): AssetVersion | undefined {
  const live = ledger.versions.filter((v) => v.node === node && v.state !== "retired");
  return live[live.length - 1];
}

export function versionById(ledger: AssetLedger, id: string): AssetVersion | undefined {
  return ledger.versions.find((v) => v.id === id);
}

/** What this version was made from. */
export function parentsOf(ledger: AssetLedger, id: string): readonly AssetVersion[] {
  return ledger.relations
    .filter((r) => r.from === id && r.type === "derived_from")
    .map((r) => versionById(ledger, r.to))
    .filter((v): v is AssetVersion => v !== undefined);
}

/**
 * What was made from this version.
 *
 * The direction the donor's model could not answer without a relation table —
 * `childIds` on the parent goes stale the moment a child is written by another
 * path, whereas walking the edge list is always current.
 */
export function childrenOf(ledger: AssetLedger, id: string): readonly AssetVersion[] {
  return ledger.relations
    .filter((r) => r.to === id && r.type === "derived_from")
    .map((r) => versionById(ledger, r.from))
    .filter((v): v is AssetVersion => v !== undefined);
}

export function star(ledger: AssetLedger, id: string, starred: boolean): AssetLedger {
  return {
    ...ledger,
    versions: ledger.versions.map((v) => (v.id === id ? { ...v, starred } : v)),
    revision: ledger.revision + 1,
  };
}

/** Soft delete. The version stays; it stops being offered. */
export function retire(ledger: AssetLedger, id: string): AssetLedger {
  return {
    ...ledger,
    versions: ledger.versions.map((v) => v.id === id ? { ...v, state: "retired" as const } : v),
    revision: ledger.revision + 1,
  };
}

// ===========================================================================
// Aggregation
// ===========================================================================

export interface LedgerSummary {
  readonly total: number;
  readonly ready: number;
  readonly failed: number;
  readonly retired: number;
  readonly starred: number;
  readonly nodes: number;
  readonly bySource: Readonly<Record<AssetSource, number>>;
  /** Sum of engine time across every recorded version, in milliseconds. */
  readonly engineMs: number;
  /** Versions still holding pixels. What the session actually costs in memory. */
  readonly withImage: number;
}

/**
 * One pass over the ledger.
 *
 * Cheap enough to call per render, but the caller should key it on
 * `ledger.revision` and not — the review's complaint about the donor was
 * precisely that these numbers were recomputed on every paint.
 */
export function summarise(ledger: AssetLedger): LedgerSummary {
  const bySource: Record<AssetSource, number> = {
    imported: 0,
    generated: 0,
    remixed: 0,
    duplicated: 0,
    manual: 0,
  };
  const nodes = new Set<NodeId>();
  let ready = 0;
  let failed = 0;
  let retired = 0;
  let starred = 0;
  let engineMs = 0;
  let withImage = 0;

  for (const v of ledger.versions) {
    nodes.add(v.node);
    bySource[v.source] += 1;
    engineMs += v.elapsedMs;
    if (v.image) withImage += 1;
    if (v.starred) starred += 1;
    if (v.state === "ready") ready += 1;
    else if (v.state === "failed") failed += 1;
    else if (v.state === "retired") retired += 1;
  }

  return {
    total: ledger.versions.length,
    ready,
    failed,
    retired,
    starred,
    nodes: nodes.size,
    bySource,
    engineMs,
    withImage,
  };
}

// ===========================================================================
// Persistence
// ===========================================================================

/**
 * The ledger without its pixels.
 *
 * What goes to disk and to localStorage. Data URLs are the overwhelming
 * majority of the bytes and the one part that can be recomputed, so they are
 * the one part not stored — a reloaded session shows its full history with
 * thumbnails that fill in on the next run.
 */
export function serialise(ledger: AssetLedger): string {
  return JSON.stringify({
    versions: ledger.versions.map(({ image: _drop, ...rest }) => rest),
    relations: ledger.relations,
    revision: ledger.revision,
  });
}

export function deserialise(text: string): AssetLedger {
  try {
    const raw = JSON.parse(text) as Partial<AssetLedger>;
    if (!Array.isArray(raw.versions) || !Array.isArray(raw.relations)) return emptyLedger();
    return {
      versions: raw.versions as AssetVersion[],
      relations: raw.relations as AssetRelation[],
      revision: typeof raw.revision === "number" ? raw.revision : 0,
    };
  } catch {
    return emptyLedger();
  }
}
