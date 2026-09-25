/**
 * lineage.ts — copy-on-write buffers, history trees, and memory digesting.
 *
 * [AXIOM 3] Source frames are never mutated. Every operation produces a new
 * immutable buffer that *records its parent and the operation that made it*,
 * so the store is not a cache with a history bolted on — it is the history,
 * and the pixels are what the history happens to hold.
 *
 * ## Why copy-on-write rather than copy-on-read
 *
 * A restoration graph is overwhelmingly made of nodes that change nothing on
 * most frames: a muted stage, a grade whose section does not cover this frame,
 * a defect repair that found no defects. Eagerly copying a 4K frame through
 * twelve such stages costs 400MB of allocation per frame to produce twelve
 * identical images. `derive()` therefore returns the *parent's* buffer id when
 * an operation reports that it changed nothing, so an untouched frame is one
 * allocation no matter how deep the graph. The history entry is still written,
 * so the provenance record stays complete — only the pixels are shared.
 *
 * [AGENT-MEMORY] The store has a hard byte budget. Past it, `digest()` folds
 * the oldest *interior* buffers into semantic summaries: the lineage edges and
 * the operation records survive in full, the pixels do not. Sources and leaves
 * are never evicted, so any surviving buffer can be recomputed by replaying
 * its recorded chain. This is the same bargain `backend/memory.py` already
 * strikes with its event log, and the vocabulary is deliberately identical.
 */

import { asBufferId, type BufferId, type NodeId } from "./ids.ts";
import { digest, digestChain } from "./hash.ts";

/** What a buffer holds. Mirrors the pixel-bearing members of `SignalKind`. */
export type BufferKind = "Image" | "Mask" | "Flow";

/** One operation, recorded so the buffer it produced can be explained or replayed. */
export interface Operation {
  /** Node type that ran, e.g. `"stage.clahe"`. */
  readonly op: string;
  /** The node instance responsible, for jumping from a buffer back to the canvas. */
  readonly node: NodeId;
  /** Parameters that produced this result. Canonicalised into the content address. */
  readonly params: Readonly<Record<string, unknown>>;
  /** Source frame index this buffer belongs to, or `null` for frame-independent results. */
  readonly frame: number | null;
}

export interface BufferRecord {
  readonly id: BufferId;
  readonly kind: BufferKind;
  /** Content address. Two records with equal `address` hold equal pixels. */
  readonly address: string;
  /** Buffers this one was derived from, in argument order. Empty for a source. */
  readonly parents: readonly BufferId[];
  /** The operation that produced it. `null` for a source frame read from disk. */
  readonly operation: Operation | null;
  readonly width: number;
  readonly height: number;
  readonly channels: number;
  /** Payload size in bytes. `0` once the record has been digested. */
  readonly bytes: number;
  /**
   * True when this record shares its parent's pixels because the operation
   * reported no change. Its `bytes` are counted once, against the parent.
   */
  readonly aliased: boolean;
  /** Pixels are gone; lineage and operation remain. Recomputable by replay. */
  readonly digested: boolean;
  /** Monotonic counter, not wall-clock: eviction order must not depend on the system clock. */
  readonly sequence: number;
  /** Reads since creation. Frequently-read buffers are evicted last. */
  readonly hits: number;
}

export interface LineageStats {
  readonly records: number;
  readonly resident: number;
  readonly digested: number;
  readonly bytes: number;
  readonly budgetBytes: number;
  /** 0..1. Above 1 means the store is over budget and `compact()` is due. */
  readonly pressure: number;
}

/** One folded-away tranche of history. */
export interface DigestSummary {
  readonly sequenceStart: number;
  readonly sequenceEnd: number;
  readonly bufferCount: number;
  readonly bytesReclaimed: number;
  /** How many buffers each operation contributed, e.g. `{ "stage.clahe": 240 }`. */
  readonly operationCounts: Readonly<Record<string, number>>;
  readonly frameRange: { readonly start: number; readonly end: number } | null;
}

export interface LineageOptions {
  /** Byte budget for resident pixels. Default 1 GiB. */
  readonly budgetBytes?: number;
  /** Fraction of the store folded away per compaction pass. Default 0.25. */
  readonly compactFraction?: number;
}

const DEFAULT_BUDGET_BYTES = 1024 * 1024 * 1024;
const DEFAULT_COMPACT_FRACTION = 0.25;

export class LineageStore {
  readonly #records = new Map<BufferId, BufferRecord>();
  /** Content address → buffer id, for deduplication. */
  readonly #byAddress = new Map<string, BufferId>();
  readonly #digests: DigestSummary[] = [];
  readonly #budgetBytes: number;
  readonly #compactFraction: number;
  #sequence = 0;
  #residentBytes = 0;

  constructor(options: LineageOptions = {}) {
    this.#budgetBytes = Math.max(1, options.budgetBytes ?? DEFAULT_BUDGET_BYTES);
    this.#compactFraction = Math.min(
      0.9,
      Math.max(0.01, options.compactFraction ?? DEFAULT_COMPACT_FRACTION),
    );
  }

  /**
   * Register a frame read from disk. Sources are roots: they have no parents,
   * no operation, and are never digested.
   */
  source(
    kind: BufferKind,
    shape: { width: number; height: number; channels: number },
    identity: { path: string; frame: number },
  ): BufferRecord {
    const address = digest({ ...identity, ...shape, kind }, "source");
    const existing = this.#byAddress.get(address);
    if (existing) return this.#touch(existing);

    return this.#insert({
      kind,
      address,
      parents: [],
      operation: null,
      ...shape,
      bytes: shape.width * shape.height * shape.channels,
      aliased: false,
    });
  }

  /**
   * Record a derived buffer.
   *
   * @param changed  whether the operation altered any pixel. When `false` the
   *                 returned record aliases its primary parent's payload — the
   *                 copy-on-write hinge. Callers must pass this honestly; a
   *                 stage that cannot tell should pass `true`.
   * @returns the new record, or an existing one when the content address
   *          already resolves — two graph branches computing the same thing
   *          share one buffer.
   */
  derive(
    parents: readonly BufferId[],
    operation: Operation,
    kind: BufferKind,
    shape: { width: number; height: number; channels: number },
    changed: boolean,
  ): BufferRecord {
    const parentAddresses = parents.map((id) => this.#records.get(id)?.address ?? "missing");
    const address = digestChain("derive", [
      ...parentAddresses,
      digest({
        op: operation.op,
        params: operation.params,
        frame: operation.frame,
        kind,
        ...shape,
      }),
    ]);

    const existing = this.#byAddress.get(address);
    if (existing) return this.#touch(existing);

    // An unchanged result is the parent's pixels under a new name.
    const primary = parents.length > 0 ? this.#records.get(parents[0]!) : undefined;
    const aliased = !changed && primary !== undefined;

    return this.#insert({
      kind,
      address,
      parents,
      operation,
      ...shape,
      bytes: aliased ? 0 : shape.width * shape.height * shape.channels,
      aliased,
    });
  }

  get(id: BufferId): BufferRecord | undefined {
    const record = this.#records.get(id);
    return record ? this.#touch(id) : undefined;
  }

  /** Look a buffer up by content address without counting a read. */
  findByAddress(address: string): BufferRecord | undefined {
    const id = this.#byAddress.get(address);
    return id ? this.#records.get(id) : undefined;
  }

  /**
   * The chain from a buffer back to its sources, nearest ancestor first.
   *
   * This is what the UI shows as "how did this frame get here", and what a
   * replay walks backwards to rebuild a digested buffer. Breadth-first, and
   * `seen`-guarded: a diamond (one source feeding two branches that later
   * recombine) must list each ancestor once, not once per path.
   */
  history(id: BufferId): BufferRecord[] {
    const out: BufferRecord[] = [];
    const seen = new Set<BufferId>();
    const queue: BufferId[] = [id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (seen.has(current)) continue;
      seen.add(current);
      const record = this.#records.get(current);
      if (!record) continue;
      out.push(record);
      queue.push(...record.parents);
    }
    return out;
  }

  /** Buffers derived from this one, directly or transitively. */
  descendants(id: BufferId): BufferRecord[] {
    const out: BufferRecord[] = [];
    for (const record of this.#records.values()) {
      if (record.parents.includes(id)) {
        out.push(record, ...this.descendants(record.id));
      }
    }
    return out;
  }

  stats(): LineageStats {
    let digested = 0;
    for (const record of this.#records.values()) if (record.digested) digested++;
    return {
      records: this.#records.size,
      resident: this.#records.size - digested,
      digested,
      bytes: this.#residentBytes,
      budgetBytes: this.#budgetBytes,
      pressure: this.#residentBytes / this.#budgetBytes,
    };
  }

  digests(): readonly DigestSummary[] {
    return this.#digests;
  }

  /**
   * Fold the oldest evictable buffers into a summary, freeing their pixels.
   *
   * Three classes are protected, and each for a concrete reason:
   *
   *   - **Sources** — nothing can regenerate a frame read from disk except
   *     re-reading the disk, and the extraction may have been decimated.
   *   - **Leaves** — a buffer with no descendants is, by definition, something
   *     currently on screen or awaiting export.
   *   - **Recently read** — `hits > 0` since the last pass means it is in the
   *     working set; evicting it guarantees an immediate recompute.
   *
   * Returns `null` when the store is within budget, so calling this every
   * frame is free.
   */
  compact(force = false): DigestSummary | null {
    if (!force && this.#residentBytes <= this.#budgetBytes) return null;

    const hasDescendant = new Set<BufferId>();
    for (const record of this.#records.values()) {
      for (const parent of record.parents) hasDescendant.add(parent);
    }

    const evictable = [...this.#records.values()]
      .filter((r) =>
        !r.digested &&
        !r.aliased &&
        r.operation !== null && // not a source
        hasDescendant.has(r.id) && // not a leaf
        r.hits === 0
      )
      .sort((a, b) => a.sequence - b.sequence);

    if (evictable.length === 0) return null;

    const targetBytes = force ? this.#residentBytes * this.#compactFraction : Math.max(
      this.#residentBytes - this.#budgetBytes,
      this.#residentBytes * this.#compactFraction,
    );

    const operationCounts: Record<string, number> = {};
    let reclaimed = 0;
    let count = 0;
    let seqStart = Infinity;
    let seqEnd = -Infinity;
    let frameStart = Infinity;
    let frameEnd = -Infinity;

    for (const record of evictable) {
      if (reclaimed >= targetBytes) break;
      const op = record.operation!.op;
      operationCounts[op] = (operationCounts[op] ?? 0) + 1;
      reclaimed += record.bytes;
      this.#residentBytes -= record.bytes;
      count++;
      seqStart = Math.min(seqStart, record.sequence);
      seqEnd = Math.max(seqEnd, record.sequence);
      const frame = record.operation!.frame;
      if (frame !== null) {
        frameStart = Math.min(frameStart, frame);
        frameEnd = Math.max(frameEnd, frame);
      }
      // Lineage and operation survive; only the payload goes.
      this.#records.set(record.id, { ...record, bytes: 0, digested: true });
    }

    if (count === 0) return null;

    const summary: DigestSummary = {
      sequenceStart: seqStart,
      sequenceEnd: seqEnd,
      bufferCount: count,
      bytesReclaimed: reclaimed,
      operationCounts,
      frameRange: frameStart <= frameEnd ? { start: frameStart, end: frameEnd } : null,
    };
    this.#digests.push(summary);
    return summary;
  }

  /**
   * The operations needed to rebuild a digested buffer, oldest first.
   *
   * Returns `[]` when the buffer is resident — nothing to do — and throws when
   * the chain reaches a digested buffer whose own parents are gone, which is
   * the one state `compact()` is designed never to produce. The check is here
   * so that a future eviction-policy change fails loudly rather than silently
   * losing a frame.
   */
  replayPlan(id: BufferId): Operation[] {
    const record = this.#records.get(id);
    if (!record) throw new Error(`No such buffer: ${id}`);
    if (!record.digested) return [];

    const plan: Operation[] = [];
    const visit = (current: BufferId, depth: number): void => {
      if (depth > 4096) throw new Error("Lineage chain too deep to replay.");
      const node = this.#records.get(current);
      if (!node) throw new Error(`Lineage broken: buffer ${current} is missing.`);
      if (!node.digested) return; // resident: a valid starting point
      if (node.operation === null) {
        throw new Error(`Lineage broken: source buffer ${current} was evicted.`);
      }
      for (const parent of node.parents) visit(parent, depth + 1);
      plan.push(node.operation);
    };
    visit(id, 0);
    return plan;
  }

  // -----------------------------------------------------------------------

  #insert(
    fields: Omit<BufferRecord, "id" | "sequence" | "hits" | "digested">,
  ): BufferRecord {
    const sequence = ++this.#sequence;
    const record: BufferRecord = {
      ...fields,
      id: asBufferId(`b${sequence}_${fields.address.slice(0, 8)}`),
      sequence,
      hits: 0,
      digested: false,
    };
    this.#records.set(record.id, record);
    this.#byAddress.set(record.address, record.id);
    this.#residentBytes += record.bytes;
    return record;
  }

  #touch(id: BufferId): BufferRecord {
    const record = this.#records.get(id)!;
    const updated = { ...record, hits: record.hits + 1 };
    this.#records.set(id, updated);
    return updated;
  }
}
