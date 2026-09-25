/**
 * hybrid.ts — the dual-storage lineage engine.
 *
 * ## The problem
 *
 * Change a prompt, regenerate, and in most tools the new image replaces the
 * old one on the node. The picture is kept; the *relationship* is lost. You can
 * no longer ask "what did this look like before I added `sharp focus`", or
 * "these two portraits came from the same base — what differs between them".
 *
 * ## Two stores, one id space
 *
 *   - **Graph** (this file): assets are nodes, transformations are directed
 *     edges. It answers ancestry — derivation, division, merge, depth, the
 *     common ancestor of two branches.
 *   - **Columns** (`core/columnar.ts`): every parameter that produced an asset,
 *     one record per asset. It answers filters over thousands of runs.
 *
 * They are joined on `asset_id`. Neither duplicates the other: the graph holds
 * no prompt text, the columns hold no parent pointers.
 *
 * ## The invariants
 *
 * 1. **Nothing is overwritten.** `derive` always mints a new asset and a new
 *    record. There is no method that edits an existing node, edge or record,
 *    and the persisted form is written to a new versioned file on every save
 *    (see `server.ts`).
 * 2. **Acyclic by construction.** A child is created in the same call that
 *    creates its edges, so it cannot already be anyone's ancestor. Imported
 *    documents, which *can* lie, are checked.
 * 3. **Origin is one of four.** `authored` (a person wrote it), `generated` (a
 *    model made it from nothing upstream), `imported` (raw external media),
 *    `derived` (made from one or more existing assets). A `derived` asset must
 *    have a parent; the other three must not.
 */

import { type Cell, type Clause, ColumnarStore, type ColumnRecord } from "./columnar.ts";
import type { ColumnarSnapshot } from "./columnar.ts";
import type { AssetSource } from "./assets.ts";
import { MODELS } from "./providers.ts";

// ===========================================================================
// Vocabulary
// ===========================================================================

export type OriginType = "authored" | "generated" | "imported" | "derived";
export const ORIGIN_TYPES: readonly OriginType[] = ["authored", "generated", "imported", "derived"];

/**
 * What an edge did. Open-ended — a pipeline can name its own — but these are
 * the ones the canvas and the compare view know how to describe.
 */
export type Transformation =
  | "prompt_tweak"
  | "param_tweak"
  | "img2img"
  | "inpaint"
  | "upscale"
  | "restore"
  | "keyframe_extract"
  | "split"
  | "merge"
  | (string & { readonly __open?: never });

export interface AssetNode {
  readonly id: string;
  readonly origin_type: OriginType;
  readonly label: string;
  /** image, video, audio, text, mesh… — informational. */
  readonly media?: string;
  /** Path under `assets/v{N}/` once materialised. Never reassigned. */
  readonly uri?: string;
  readonly created_at: string;
}

export interface LineageEdge {
  readonly from: string;
  readonly to: string;
  readonly transformation: Transformation;
}

export class LineageError extends Error {
  override name = "LineageError";
}

/** Map the ledger's source vocabulary onto the four origins. */
export function originOf(source: AssetSource): OriginType {
  switch (source) {
    case "imported":
      return "imported";
    case "generated":
      return "generated";
    case "manual":
      return "authored";
    case "remixed":
    case "duplicated":
      return "derived";
  }
}

// ===========================================================================
// The store
// ===========================================================================

export interface CreateInput {
  readonly origin_type: Exclude<OriginType, "derived">;
  readonly label: string;
  readonly media?: string;
  readonly uri?: string;
  /** Parameters that produced it. `record_id`/`asset_id` are assigned. */
  readonly params?: Readonly<Record<string, Cell>>;
  readonly id?: string;
}

export interface DeriveInput {
  readonly parents: readonly string[];
  readonly label: string;
  readonly transformation: Transformation;
  /**
   * Fields that differ from the first parent's record. Everything else is
   * inherited, so a prompt tweak is logged as the full parameter set that
   * actually ran — not as a diff someone has to replay.
   */
  readonly changes?: Readonly<Record<string, Cell>>;
  /**
   * Per-parent transformation, parallel to `parents`, when the edges differ —
   * a re-run links to its previous version by `param_tweak` and to its
   * upstream input by the stage that consumed it. Falls back to `transformation`.
   */
  readonly transformations?: readonly Transformation[];
  /** Inherit the first parent's parameters (default). Off when `changes` is complete. */
  readonly inherit?: boolean;
  readonly media?: string;
  readonly uri?: string;
  readonly id?: string;
}

export interface Created {
  readonly asset: AssetNode;
  readonly record: ColumnRecord;
}

export interface FieldDelta {
  readonly field: string;
  readonly a: Cell;
  readonly b: Cell;
}

export interface Comparison {
  readonly a: string;
  readonly b: string;
  /** Nearest shared ancestor, or null when the two share no history. */
  readonly common: string | null;
  /** Path from the common ancestor down to each side, inclusive. */
  readonly pathA: readonly string[];
  readonly pathB: readonly string[];
  /** Parameter fields whose values differ, in schema order. */
  readonly changed: readonly FieldDelta[];
  /** Transformations along each path, for the "what happened" line. */
  readonly transformationsA: readonly Transformation[];
  readonly transformationsB: readonly Transformation[];
}

export interface HybridSnapshot {
  readonly format: "arstechnic.hybrid/1";
  readonly nodes: readonly AssetNode[];
  readonly edges: readonly LineageEdge[];
  readonly columns: ColumnarSnapshot;
  readonly counters: { readonly asset: number; readonly record: number };
}

/** Fields that describe bookkeeping rather than a creative decision. */
const NON_PARAMETER_FIELDS = new Set(["record_id", "asset_id", "execution_time_ms", "created_at"]);

export interface HybridOptions {
  readonly now?: () => Date;
}

export class HybridLineage {
  readonly columns: ColumnarStore;
  readonly #nodes = new Map<string, AssetNode>();
  readonly #out = new Map<string, LineageEdge[]>();
  readonly #in = new Map<string, LineageEdge[]>();
  #assetCounter = 0;
  #recordCounter = 0;
  readonly #now: () => Date;

  constructor(options: HybridOptions = {}) {
    this.columns = new ColumnarStore();
    this.#now = options.now ?? (() => new Date());
  }

  get size(): number {
    return this.#nodes.size;
  }

  node(id: string): AssetNode | null {
    return this.#nodes.get(id) ?? null;
  }

  nodes(): AssetNode[] {
    return [...this.#nodes.values()];
  }

  edges(): LineageEdge[] {
    return [...this.#out.values()].flat();
  }

  parentsOf(id: string): string[] {
    return (this.#in.get(id) ?? []).map((e) => e.from);
  }

  childrenOf(id: string): string[] {
    return (this.#out.get(id) ?? []).map((e) => e.to);
  }

  edgesInto(id: string): readonly LineageEdge[] {
    return this.#in.get(id) ?? [];
  }

  /** The parameter record of an asset — the latest one if several were logged. */
  paramsOf(id: string): ColumnRecord | null {
    const records = this.columns.recordsOf(id);
    return records[records.length - 1] ?? null;
  }

  /** A root asset: authored, generated or imported. */
  create(input: CreateInput): Created {
    if ((input.origin_type as OriginType) === "derived") {
      throw new LineageError("A derived asset needs parents — use derive().");
    }
    const asset = this.#mint(input.id, input.origin_type, input.label, input.media, input.uri);
    const record = this.#log(asset.id, input.params ?? {});
    return { asset, record };
  }

  /**
   * A new asset made from existing ones.
   *
   * One parent is the ordinary case — a prompt tweak, an img2img pass. Several
   * is a merge. The parameter record inherits from the *first* parent, so
   * order the parents with the one whose settings you started from first.
   */
  derive(input: DeriveInput): Created {
    if (input.parents.length === 0) {
      throw new LineageError("derive() needs at least one parent.");
    }
    const unique = new Set(input.parents);
    if (unique.size !== input.parents.length) {
      throw new LineageError("A parent is listed twice.");
    }
    for (const p of input.parents) {
      if (!this.#nodes.has(p)) throw new LineageError(`No asset ${p} to derive from.`);
    }

    if (input.transformations && input.transformations.length !== input.parents.length) {
      throw new LineageError("transformations must parallel parents.");
    }
    const inherited: Record<string, Cell> = {};
    const base = input.inherit === false ? null : this.paramsOf(input.parents[0]!);
    if (base) {
      for (const [k, v] of Object.entries(base)) {
        if (!NON_PARAMETER_FIELDS.has(k)) inherited[k] = v;
      }
    }
    const params = { ...inherited, ...(input.changes ?? {}) };

    const asset = this.#mint(input.id, "derived", input.label, input.media, input.uri);
    // A refused record (a kind conflict) removes the node again — no orphans.
    const record = this.#log(asset.id, params);
    for (const [i, parent] of input.parents.entries()) {
      const transformation = input.transformations?.[i] ?? input.transformation;
      const edge: LineageEdge = { from: parent, to: asset.id, transformation };
      this.#push(this.#out, parent, edge);
      this.#push(this.#in, asset.id, edge);
    }
    return { asset, record };
  }

  /** Divide one asset into several children — keyframes out of a clip. */
  split(
    parent: string,
    parts: ReadonlyArray<{ label: string; changes?: Readonly<Record<string, Cell>> }>,
    transformation: Transformation = "split",
  ): Created[] {
    return parts.map((part) =>
      this.derive({
        parents: [parent],
        label: part.label,
        transformation,
        ...(part.changes ? { changes: part.changes } : {}),
      })
    );
  }

  /** Every ancestor with its distance, nearest first. */
  ancestors(id: string): Map<string, number> {
    const dist = new Map<string, number>();
    let frontier = [id];
    let d = 0;
    while (frontier.length > 0) {
      d++;
      const next: string[] = [];
      for (const n of frontier) {
        for (const p of this.parentsOf(n)) {
          if (!dist.has(p)) {
            dist.set(p, d);
            next.push(p);
          }
        }
      }
      frontier = next;
    }
    return dist;
  }

  descendants(id: string): Set<string> {
    const seen = new Set<string>();
    const stack = [id];
    while (stack.length > 0) {
      for (const c of this.childrenOf(stack.pop()!)) {
        if (!seen.has(c)) {
          seen.add(c);
          stack.push(c);
        }
      }
    }
    return seen;
  }

  /** Longest distance to a root. A root is depth 0. */
  depth(id: string): number {
    const memo = new Map<string, number>();
    const visit = (n: string): number => {
      const cached = memo.get(n);
      if (cached !== undefined) return cached;
      const parents = this.parentsOf(n);
      const value = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(visit));
      memo.set(n, value);
      return value;
    };
    return visit(id);
  }

  /**
   * The nearest ancestor two assets share (either may be the other's ancestor).
   * "Nearest" minimises the larger of the two distances, then the sum.
   */
  commonAncestor(a: string, b: string): string | null {
    this.#require(a);
    this.#require(b);
    const da = this.ancestors(a);
    da.set(a, 0);
    const db = this.ancestors(b);
    db.set(b, 0);
    let best: string | null = null;
    let bestKey: [number, number] = [Infinity, Infinity];
    for (const [n, x] of da) {
      const y = db.get(n);
      if (y === undefined) continue;
      const key: [number, number] = [Math.max(x, y), x + y];
      if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
        best = n;
        bestKey = key;
      }
    }
    return best;
  }

  /** A shortest ancestry path from `from` down to `to`, inclusive, or null. */
  pathBetween(from: string, to: string): string[] | null {
    if (from === to) return [from];
    const prev = new Map<string, string>();
    const queue = [from];
    const seen = new Set([from]);
    while (queue.length > 0) {
      const n = queue.shift()!;
      for (const c of this.childrenOf(n)) {
        if (seen.has(c)) continue;
        seen.add(c);
        prev.set(c, n);
        if (c === to) {
          const path = [to];
          let cur = to;
          while (prev.has(cur)) {
            cur = prev.get(cur)!;
            path.unshift(cur);
          }
          return path;
        }
        queue.push(c);
      }
    }
    return null;
  }

  /** Side-by-side: common ancestor, both paths, and every parameter that differs. */
  compare(a: string, b: string): Comparison {
    const common = this.commonAncestor(a, b);
    const pathA = common ? this.pathBetween(common, a) ?? [a] : [a];
    const pathB = common ? this.pathBetween(common, b) ?? [b] : [b];
    const ra = this.paramsOf(a) ?? ({} as ColumnRecord);
    const rb = this.paramsOf(b) ?? ({} as ColumnRecord);
    const changed: FieldDelta[] = [];
    for (const { field } of this.columns.schema()) {
      if (NON_PARAMETER_FIELDS.has(field)) continue;
      const va = ra[field] ?? null;
      const vb = rb[field] ?? null;
      if (va !== vb) changed.push({ field, a: va, b: vb });
    }
    return {
      a,
      b,
      common,
      pathA,
      pathB,
      changed,
      transformationsA: this.#transformsAlong(pathA),
      transformationsB: this.#transformsAlong(pathB),
    };
  }

  /** Filter the parameter log and join each hit back to its asset. */
  query(where: readonly Clause[]): Array<{ asset: AssetNode; record: ColumnRecord }> {
    return this.columns.query({ where }).flatMap((record) => {
      const asset = this.#nodes.get(record.asset_id);
      return asset ? [{ asset, record }] : [];
    });
  }

  snapshot(): HybridSnapshot {
    return {
      format: "arstechnic.hybrid/1",
      nodes: this.nodes(),
      edges: this.edges(),
      columns: this.columns.snapshot(),
      counters: { asset: this.#assetCounter, record: this.#recordCounter },
    };
  }

  static fromSnapshot(snapshot: HybridSnapshot, options: HybridOptions = {}): HybridLineage {
    if (snapshot.format !== "arstechnic.hybrid/1") {
      throw new LineageError(`Unknown lineage format: ${String(snapshot.format)}`);
    }
    const store = new HybridLineage(options);
    store.#load(snapshot.nodes, snapshot.edges);
    const columns = ColumnarStore.fromSnapshot(snapshot.columns);
    // Replace the empty store's columns by re-appending — keeps `columns` readonly.
    for (let r = 0; r < columns.size; r++) store.columns.append(columns.row(r));
    store.#assetCounter = snapshot.counters.asset;
    store.#recordCounter = snapshot.counters.record;
    return store;
  }

  // -------------------------------------------------------------------------
  // The published blueprint format (schemas/hybrid_blueprint.json)
  // -------------------------------------------------------------------------

  toBlueprint(meta: { workflow_id: string; title: string; version: string }): HybridBlueprint {
    const nodes = this.nodes().map((n) => {
      const out = this.childrenOf(n.id);
      const inn = this.parentsOf(n.id);
      return {
        id: n.id,
        type: "asset_node" as const,
        origin_type: n.origin_type,
        label: n.label,
        ...(out.length ? { edges_out: out } : {}),
        ...(inn.length ? { edges_in: inn } : {}),
        ...(inn.length
          ? { transformations_in: this.edgesInto(n.id).map((e) => e.transformation) }
          : {}),
      };
    });
    const columnar_parameters = this.columns.query();
    return {
      $schema: BLUEPRINT_SCHEMA_URL,
      ...meta,
      graph_structure: { nodes },
      columnar_parameters,
      cost_estimation: this.costEstimation(),
    };
  }

  static fromBlueprint(doc: unknown, options: HybridOptions = {}): HybridLineage {
    const problems = validateBlueprint(doc);
    if (problems.length > 0) {
      throw new LineageError(`Blueprint is not valid:\n  - ${problems.join("\n  - ")}`);
    }
    const bp = doc as HybridBlueprint;
    const store = new HybridLineage(options);
    const created = store.#now().toISOString();
    const nodes: AssetNode[] = bp.graph_structure.nodes.map((n) => ({
      id: n.id,
      origin_type: n.origin_type,
      label: n.label,
      created_at: created,
    }));
    const edges: LineageEdge[] = [];
    for (const n of bp.graph_structure.nodes) {
      (n.edges_in ?? []).forEach((from, i) => {
        edges.push({ from, to: n.id, transformation: n.transformations_in?.[i] ?? "derived" });
      });
    }
    store.#load(nodes, edges);
    for (const rec of bp.columnar_parameters) store.columns.append(rec);
    store.#assetCounter = nodes.length;
    store.#recordCounter = bp.columnar_parameters.length;
    return store;
  }

  /**
   * Branches = root-to-leaf paths; execution paths = assets that had to be
   * computed (everything but imports and authored text). Cost prefers an
   * explicit `cost_usd` column and falls back to the model catalogue by name.
   */
  costEstimation(): CostEstimation {
    const pathCount = new Map<string, number>();
    const order = this.#topological();
    for (const id of order) {
      const parents = this.parentsOf(id);
      pathCount.set(
        id,
        parents.length === 0 ? 1 : parents.reduce((s, p) => s + (pathCount.get(p) ?? 0), 0),
      );
    }
    let branches = 0;
    let executions = 0;
    let cents = 0;
    for (const n of this.#nodes.values()) {
      if (this.childrenOf(n.id).length === 0) branches += pathCount.get(n.id) ?? 0;
      if (n.origin_type === "generated" || n.origin_type === "derived") executions++;
      const rec = this.paramsOf(n.id);
      if (!rec) continue;
      if (typeof rec.cost_usd === "number") cents += rec.cost_usd * 100;
      else if (n.origin_type === "generated" || n.origin_type === "derived") {
        cents += centsForModelName(rec.model_name);
      }
    }
    return {
      total_branches: branches,
      total_execution_paths: executions,
      estimated_compute_cost_usd: Math.round(cents) / 100,
    };
  }

  // -------------------------------------------------------------------------

  #mint(
    id: string | undefined,
    origin_type: OriginType,
    label: string,
    media?: string,
    uri?: string,
  ): AssetNode {
    const assetId = id ?? `ast_${++this.#assetCounter}`;
    if (id !== undefined) this.#assetCounter++;
    if (this.#nodes.has(assetId)) {
      throw new LineageError(`Asset ${assetId} already exists; assets are never overwritten.`);
    }
    if (!label.trim()) throw new LineageError("An asset needs a label.");
    const asset: AssetNode = {
      id: assetId,
      origin_type,
      label,
      ...(media ? { media } : {}),
      ...(uri ? { uri } : {}),
      created_at: this.#now().toISOString(),
    };
    this.#nodes.set(assetId, asset);
    return asset;
  }

  #log(assetId: string, params: Readonly<Record<string, Cell>>): ColumnRecord {
    const recordId = `col_log_${++this.#recordCounter}`;
    const record = { ...params, record_id: recordId, asset_id: assetId } as ColumnRecord;
    try {
      this.columns.append(record);
    } catch (error) {
      this.#recordCounter--;
      if (!this.#in.has(assetId)) this.#nodes.delete(assetId);
      throw error;
    }
    return this.columns.record(recordId)!;
  }

  #push(map: Map<string, LineageEdge[]>, key: string, edge: LineageEdge): void {
    const list = map.get(key) ?? [];
    list.push(edge);
    map.set(key, list);
  }

  #require(id: string): void {
    if (!this.#nodes.has(id)) throw new LineageError(`No asset ${id}.`);
  }

  #transformsAlong(path: readonly string[]): Transformation[] {
    const out: Transformation[] = [];
    for (let i = 1; i < path.length; i++) {
      const edge = this.edgesInto(path[i]!).find((e) => e.from === path[i - 1]);
      if (edge) out.push(edge.transformation);
    }
    return out;
  }

  #topological(): string[] {
    const indeg = new Map<string, number>();
    for (const id of this.#nodes.keys()) indeg.set(id, this.parentsOf(id).length);
    const queue = [...indeg].filter(([, d]) => d === 0).map(([id]) => id);
    const order: string[] = [];
    while (queue.length > 0) {
      const n = queue.shift()!;
      order.push(n);
      for (const c of this.childrenOf(n)) {
        const d = indeg.get(c)! - 1;
        indeg.set(c, d);
        if (d === 0) queue.push(c);
      }
    }
    return order;
  }

  #load(nodes: readonly AssetNode[], edges: readonly LineageEdge[]): void {
    for (const n of nodes) {
      if (this.#nodes.has(n.id)) throw new LineageError(`Duplicate asset ${n.id}.`);
      this.#nodes.set(n.id, n);
    }
    for (const e of edges) {
      if (!this.#nodes.has(e.from) || !this.#nodes.has(e.to)) {
        throw new LineageError(`Edge ${e.from} → ${e.to} names an unknown asset.`);
      }
      this.#push(this.#out, e.from, e);
      this.#push(this.#in, e.to, e);
    }
    if (this.#topological().length !== this.#nodes.size) {
      throw new LineageError("The lineage graph contains a cycle.");
    }
  }
}

function centsForModelName(name: Cell | undefined): number {
  if (typeof name !== "string") return 0;
  const needle = name.toLowerCase();
  const spec = MODELS.find((m) => needle.startsWith(m.name.toLowerCase())) ??
    MODELS.find((m) => m.id.toLowerCase().includes(needle));
  return spec?.centsPerCall ?? 0;
}

// ===========================================================================
// Blueprint document
// ===========================================================================

export const BLUEPRINT_SCHEMA_URL = "https://arttechnic.ai/schemas/v2/hybrid_blueprint.json";

export interface BlueprintNode {
  readonly id: string;
  readonly type: "asset_node";
  readonly origin_type: OriginType;
  readonly label: string;
  readonly edges_out?: readonly string[];
  readonly edges_in?: readonly string[];
  /** Parallel to `edges_in`. Optional extension; absent reads as "derived". */
  readonly transformations_in?: readonly Transformation[];
}

export interface CostEstimation {
  readonly total_branches: number;
  readonly total_execution_paths: number;
  readonly estimated_compute_cost_usd: number;
}

export interface HybridBlueprint {
  readonly $schema: string;
  readonly workflow_id: string;
  readonly title: string;
  readonly version: string;
  readonly graph_structure: { readonly nodes: readonly BlueprintNode[] };
  readonly columnar_parameters: readonly ColumnRecord[];
  readonly cost_estimation: CostEstimation;
}

/**
 * Every structural problem in a blueprint document, as sentences.
 *
 * Checked: required fields, origin vocabulary, unique ids, dangling edge
 * references, `edges_in`/`edges_out` agreeing with each other, the origin
 * rule (derived ⇔ has parents), cycles, and that each parameter record points
 * at a node and has a unique id. An empty array means valid.
 */
export function validateBlueprint(doc: unknown): string[] {
  const problems: string[] = [];
  if (typeof doc !== "object" || doc === null) return ["The document is not an object."];
  const d = doc as Record<string, unknown>;
  for (const key of ["workflow_id", "title", "version"]) {
    if (typeof d[key] !== "string" || d[key] === "") {
      problems.push(`${key} must be a non-empty string.`);
    }
  }
  if (typeof d.version === "string" && !/^\d+\.\d+\.\d+$/.test(d.version)) {
    problems.push(`version must be semver (got ${d.version}).`);
  }
  const gs = d.graph_structure as { nodes?: unknown } | undefined;
  if (!gs || !Array.isArray(gs.nodes)) {
    problems.push("graph_structure.nodes must be an array.");
    return problems;
  }
  const nodes = gs.nodes as Array<Record<string, unknown>>;
  const ids = new Set<string>();
  for (const [i, n] of nodes.entries()) {
    const where = `graph_structure.nodes[${i}]`;
    if (typeof n.id !== "string" || !n.id) {
      problems.push(`${where}.id must be a non-empty string.`);
      continue;
    }
    if (ids.has(n.id)) problems.push(`Asset id ${n.id} appears twice.`);
    ids.add(n.id);
    if (n.type !== "asset_node") problems.push(`${n.id}: type must be "asset_node".`);
    if (!ORIGIN_TYPES.includes(n.origin_type as OriginType)) {
      problems.push(`${n.id}: origin_type must be one of ${ORIGIN_TYPES.join(", ")}.`);
    }
    if (typeof n.label !== "string" || !n.label) problems.push(`${n.id}: label is required.`);
    for (const key of ["edges_in", "edges_out"]) {
      if (n[key] !== undefined && !Array.isArray(n[key])) {
        problems.push(`${n.id}: ${key} must be an array.`);
      }
    }
  }
  const byId = new Map(
    nodes.filter((n) => typeof n.id === "string").map((n) => [n.id as string, n]),
  );
  const list = (n: Record<string, unknown>, key: string): string[] =>
    Array.isArray(n[key])
      ? (n[key] as unknown[]).filter((x): x is string => typeof x === "string")
      : [];

  for (const n of byId.values()) {
    const id = n.id as string;
    for (const target of list(n, "edges_out")) {
      const t = byId.get(target);
      if (!t) problems.push(`${id}: edges_out names unknown asset ${target}.`);
      else if (!list(t, "edges_in").includes(id)) {
        problems.push(`${id} → ${target} is in ${id}.edges_out but not in ${target}.edges_in.`);
      }
    }
    for (const source of list(n, "edges_in")) {
      const s = byId.get(source);
      if (!s) problems.push(`${id}: edges_in names unknown asset ${source}.`);
      else if (!list(s, "edges_out").includes(id)) {
        problems.push(`${source} → ${id} is in ${id}.edges_in but not in ${source}.edges_out.`);
      }
    }
    const hasParents = list(n, "edges_in").length > 0;
    if (n.origin_type === "derived" && !hasParents) {
      problems.push(`${id} is derived but has no edges_in — a derived asset needs a parent.`);
    }
    if (
      n.origin_type !== "derived" && ORIGIN_TYPES.includes(n.origin_type as OriginType) &&
      hasParents
    ) {
      problems.push(
        `${id} has parents, so its origin_type must be "derived", not "${n.origin_type}".`,
      );
    }
    const tIn = n.transformations_in;
    if (tIn !== undefined && (!Array.isArray(tIn) || tIn.length !== list(n, "edges_in").length)) {
      problems.push(`${id}: transformations_in must parallel edges_in.`);
    }
  }

  // Cycle check over edges_in (Kahn).
  const indeg = new Map<string, number>();
  for (const [id, n] of byId) indeg.set(id, list(n, "edges_in").filter((p) => byId.has(p)).length);
  const queue = [...indeg].filter(([, v]) => v === 0).map(([k]) => k);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift()!;
    visited++;
    for (const [other, n] of byId) {
      if (list(n, "edges_in").includes(id)) {
        const v = indeg.get(other)! - 1;
        indeg.set(other, v);
        if (v === 0) queue.push(other);
      }
    }
  }
  if (visited < byId.size) problems.push("The lineage graph contains a cycle.");

  if (!Array.isArray(d.columnar_parameters)) {
    problems.push("columnar_parameters must be an array.");
  } else {
    const recordIds = new Set<string>();
    for (const [i, r] of (d.columnar_parameters as Array<Record<string, unknown>>).entries()) {
      const where = `columnar_parameters[${i}]`;
      if (typeof r.record_id !== "string" || !r.record_id) {
        problems.push(`${where}.record_id is required.`);
      } else if (recordIds.has(r.record_id)) {
        problems.push(`Record ${r.record_id} appears twice.`);
      } else recordIds.add(r.record_id);
      if (typeof r.asset_id !== "string" || !byId.has(r.asset_id)) {
        problems.push(`${where}.asset_id must name an asset in graph_structure.`);
      }
      for (const [k, v] of Object.entries(r)) {
        if (v !== null && typeof v === "object") problems.push(`${where}.${k} must be a scalar.`);
      }
    }
  }
  return problems;
}
