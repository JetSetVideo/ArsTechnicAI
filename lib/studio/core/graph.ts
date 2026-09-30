/**
 * graph.ts — the blueprint document and its evaluation order.
 *
 * A graph is a plain, serialisable record: nodes with a position and a
 * parameter bag, edges between ports, and stacks that give a set of nodes a
 * shared Z axis. Nothing here executes anything or knows what a frame is; it
 * answers two questions only — *is this graph well-formed* and *in what order
 * must it run*.
 *
 * [AGENT-MEMORY] Every node carries `revision` and `authoredBy`, so a graph is
 * self-describing history: the UI can mark an unreviewed machine suggestion,
 * and the digest engine can compress old revisions without losing who decided
 * what. This mirrors the provenance vocabulary already used by the restorer's
 * `segments.py`, deliberately — the same three actors, spelled the same way.
 */

import {
  asEdgeId,
  type EdgeId,
  type GraphId,
  type NodeId,
  type NodeTypeId,
  type PortId,
  type PortRef,
  type StackId,
} from "./ids.ts";
import {
  checkConnection,
  type ConnectionRefusal,
  type PortDirection,
  type PortSpec,
  type SignalValue,
} from "./ports.ts";
import { type Rect, snapPoint, type Vec2 } from "./spatial.ts";
import { digest } from "./hash.ts";

/** Who authored a value. Identical vocabulary to `backend/memory.py`. */
export type Actor = "user" | "ai" | "system";

/** A node's lifecycle state, which drives its shadow depth and border. */
export type NodeState =
  /** Never evaluated. */
  | "idle"
  /** Queued or running. */
  | "evaluating"
  /** Output is current and cached. */
  | "fresh"
  /** Output exists but an upstream change invalidated it. */
  | "stale"
  /** Last evaluation failed; `error` holds the reason. */
  | "failed"
  /** Deliberately bypassed — passes its primary input straight through. */
  | "muted";

export interface NodeInstance {
  readonly id: NodeId;
  readonly type: NodeTypeId;
  /** Secondary-typography display name. User-editable; defaults to the type's label. */
  readonly name: string;
  /** Top-left on the blueprint plane, in blueprint units. */
  readonly position: Vec2;
  /** Card size in blueprint units. Held on the instance because a node can be collapsed. */
  readonly size: { readonly w: number; readonly h: number };
  /** Membership in a Z stack, and which slice this node occupies. */
  readonly stack?: { readonly id: StackId; readonly slice: number };
  /** Values for ports with no incoming wire. Keyed by `PortId`. */
  readonly values: Readonly<Record<string, SignalValue>>;
  /** Per-port authorship, so an AI suggestion never passes for a user decision. */
  readonly authoredBy: Readonly<Record<string, Actor>>;
  readonly state: NodeState;
  /** Present only when `state === "failed"`. */
  readonly error?: string;
  /** Bumped on every accepted edit. Drives cache invalidation and the digest. */
  readonly revision: number;
  readonly collapsed: boolean;
}

export interface EdgeInstance {
  readonly id: EdgeId;
  readonly from: PortRef;
  readonly to: PortRef;
  /**
   * Ordering among several wires into one variadic input. Lower runs first.
   * Meaningless — and ignored — on non-variadic inputs.
   */
  readonly order: number;
}

/**
 * A Z-axis stack: a set of nodes evaluated once per slice.
 *
 * `source` names where the slice count comes from. `frames` binds the stack to
 * a frame range of the project, which is the temporal-loop case; `versions`
 * makes the slices independent alternatives of the same sub-graph, which is
 * the stacked-versioning case. They share every piece of geometry and differ
 * only in what a slice *means*.
 */
export interface StackInstance {
  readonly id: StackId;
  readonly label: string;
  readonly source: "frames" | "versions";
  /** Inclusive frame range, present when `source === "frames"`. */
  readonly range?: { readonly start: number; readonly end: number; readonly step: number };
  readonly sliceCount: number;
  readonly focusIndex: number;
  readonly wrap: boolean;
  /** Where the stack shrinks toward, in blueprint units. */
  readonly origin: Vec2;
}

export interface GraphDocument {
  readonly id: GraphId;
  /** The ArchiveRestorer project this blueprint operates on, if bound. */
  readonly projectId: string | null;
  readonly nodes: Readonly<Record<string, NodeInstance>>;
  readonly edges: Readonly<Record<string, EdgeInstance>>;
  readonly stacks: Readonly<Record<string, StackInstance>>;
  readonly revision: number;
}

export const emptyGraph = (id: GraphId): GraphDocument => ({
  id,
  projectId: null,
  nodes: {},
  edges: {},
  stacks: {},
  revision: 0,
});

/** The rectangle a node occupies, for collision and fit-to-view. */
export const nodeRect = (node: NodeInstance): Rect => ({
  x: node.position.x,
  y: node.position.y,
  w: node.size.w,
  h: node.collapsed ? Math.min(node.size.h, 34) : node.size.h,
});

// ===========================================================================
// Adjacency
// ===========================================================================

/** Edges arriving at each node, and edges leaving each node. */
export interface Adjacency {
  readonly incoming: ReadonlyMap<NodeId, readonly EdgeInstance[]>;
  readonly outgoing: ReadonlyMap<NodeId, readonly EdgeInstance[]>;
}

export function buildAdjacency(graph: GraphDocument): Adjacency {
  const incoming = new Map<NodeId, EdgeInstance[]>();
  const outgoing = new Map<NodeId, EdgeInstance[]>();
  for (const id of Object.keys(graph.nodes)) {
    incoming.set(id as NodeId, []);
    outgoing.set(id as NodeId, []);
  }
  for (const edge of Object.values(graph.edges)) {
    outgoing.get(edge.from.node)?.push(edge);
    incoming.get(edge.to.node)?.push(edge);
  }
  // Variadic inputs are order-sensitive; sort once here so every consumer sees
  // the same sequence rather than relying on object key order.
  for (const list of incoming.values()) list.sort((a, b) => a.order - b.order);
  return { incoming, outgoing };
}

/** Which wire, if any, currently feeds a given input port. */
export function edgesInto(adjacency: Adjacency, node: NodeId, port: PortId): EdgeInstance[] {
  return (adjacency.incoming.get(node) ?? []).filter((e) => e.to.port === port);
}

// ===========================================================================
// Cycles and evaluation order
// ===========================================================================

export interface TopoSuccess {
  readonly ok: true;
  /** Nodes in a valid execution order: every node follows all its sources. */
  readonly order: readonly NodeId[];
  /**
   * Nodes grouped into waves that share no dependency. Every node in wave *k*
   * depends only on waves < *k*, so a wave may run concurrently — which is how
   * a Z stack evaluates its slices in parallel.
   */
  readonly waves: readonly (readonly NodeId[])[];
}

export interface TopoFailure {
  readonly ok: false;
  /** One node id per cycle member, in the order they were found. */
  readonly cycle: readonly NodeId[];
  readonly message: string;
}

export type TopoResult = TopoSuccess | TopoFailure;

/**
 * Kahn's algorithm, extended to emit dependency waves.
 *
 * Kahn is chosen over depth-first ordering for two reasons: it detects a cycle
 * by *leftover nodes* rather than by recursion depth (so a 4000-slice stack
 * cannot blow the JS stack), and its frontier is exactly the set of nodes that
 * may run concurrently, which the evaluator needs anyway.
 */
export function topologicalOrder(graph: GraphDocument): TopoResult {
  const adjacency = buildAdjacency(graph);
  const remainingDeps = new Map<NodeId, number>();
  for (const id of Object.keys(graph.nodes)) {
    const nodeId = id as NodeId;
    // Count distinct *source nodes*, not edges: two wires from the same node
    // into two ports are one dependency, and counting edges would deadlock.
    const sources = new Set(
      (adjacency.incoming.get(nodeId) ?? []).map((e) => e.from.node),
    );
    sources.delete(nodeId);
    remainingDeps.set(nodeId, sources.size);
  }

  let frontier = [...remainingDeps.entries()]
    .filter(([, n]) => n === 0)
    .map(([id]) => id)
    .sort();

  const order: NodeId[] = [];
  const waves: NodeId[][] = [];
  const settled = new Set<NodeId>();

  while (frontier.length > 0) {
    waves.push(frontier);
    const next = new Set<NodeId>();
    for (const nodeId of frontier) {
      order.push(nodeId);
      settled.add(nodeId);
      const seen = new Set<NodeId>();
      for (const edge of adjacency.outgoing.get(nodeId) ?? []) {
        const target = edge.to.node;
        if (target === nodeId || seen.has(target)) continue;
        seen.add(target);
        const left = (remainingDeps.get(target) ?? 0) - 1;
        remainingDeps.set(target, left);
        if (left === 0) next.add(target);
      }
    }
    frontier = [...next].sort();
  }

  const nodeCount = Object.keys(graph.nodes).length;
  if (order.length !== nodeCount) {
    const cycle = Object.keys(graph.nodes)
      .map((id) => id as NodeId)
      .filter((id) => !settled.has(id));
    return {
      ok: false,
      cycle,
      message: `${cycle.length} node(s) form a feedback loop and cannot be ordered: ${
        cycle.join(", ")
      }. Break the loop, or express it as a Z stack — depth is how this canvas does iteration.`,
    };
  }
  return { ok: true, order, waves };
}

/**
 * Would adding this wire create a cycle?
 *
 * Answered by walking *backwards* from the proposed source: if the proposed
 * target is already upstream of it, closing the wire would form a loop.
 * Cheaper than building the candidate graph and re-sorting it, and it runs on
 * every pointer-move during a drag.
 */
export function wouldCreateCycle(graph: GraphDocument, from: NodeId, to: NodeId): boolean {
  if (from === to) return true;
  const adjacency = buildAdjacency(graph);
  const stack: NodeId[] = [from];
  const seen = new Set<NodeId>([from]);
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === to) return true;
    for (const edge of adjacency.incoming.get(current) ?? []) {
      if (seen.has(edge.from.node)) continue;
      seen.add(edge.from.node);
      stack.push(edge.from.node);
    }
  }
  return false;
}

/**
 * How a caller turns a `PortRef` into the port it names.
 *
 * The direction is part of the query because a node's input and its output
 * routinely share an id (`image` in, `image` out). Injected rather than
 * imported so this module stays independent of the node-type registry, and so
 * tests can supply ports directly.
 */
export type PortResolver = (
  node: NodeId,
  port: PortId,
  direction: PortDirection,
) => PortSpec | null;

/** Full connection check: port rules first, then the graph-wide cycle rule. */
export function canConnect(
  graph: GraphDocument,
  from: PortRef,
  to: PortRef,
  resolvePort: PortResolver,
): ConnectionRefusal | null {
  const fromSpec = resolvePort(from.node, from.port, "output");
  const toSpec = resolvePort(to.node, to.port, "input");
  if (!fromSpec || !toSpec) {
    return { reason: "kind-mismatch", message: "That socket no longer exists." };
  }
  const adjacency = buildAdjacency(graph);
  const occupied = edgesInto(adjacency, to.node, to.port).length > 0;
  const refusal = checkConnection(
    { node: from.node, port: fromSpec },
    { node: to.node, port: toSpec, occupied },
  );
  if (refusal) return refusal;

  if (wouldCreateCycle(graph, from.node, to.node)) {
    return {
      reason: "would-cycle",
      message:
        "That wire would feed the pipeline back into itself. Iteration belongs on the Z axis — put these nodes in a stack instead.",
    };
  }
  return null;
}

// ===========================================================================
// Edits — every one returns a new document
// ===========================================================================

/**
 * [AXIOM 3 — Data Immutability] No function in this module mutates its input.
 * An edit returns a fresh `GraphDocument` sharing every untouched node by
 * reference, which is what lets undo be a stack of pointers rather than a
 * stack of deep copies, and lets the evaluator detect change by `!==`.
 */

export function addNode(graph: GraphDocument, node: NodeInstance): GraphDocument {
  return {
    ...graph,
    nodes: { ...graph.nodes, [node.id]: node },
    revision: graph.revision + 1,
  };
}

export function updateNode(
  graph: GraphDocument,
  id: NodeId,
  patch: Partial<Omit<NodeInstance, "id" | "revision">>,
): GraphDocument {
  const existing = graph.nodes[id];
  if (!existing) return graph;
  const updated: NodeInstance = { ...existing, ...patch, revision: existing.revision + 1 };
  return {
    ...graph,
    nodes: { ...graph.nodes, [id]: updated },
    revision: graph.revision + 1,
  };
}

/** Move a node, snapping to the grid. Collision avoidance lives in the view. */
export function moveNode(graph: GraphDocument, id: NodeId, to: Vec2): GraphDocument {
  return updateNode(graph, id, { position: snapPoint(to) });
}

export function removeNode(graph: GraphDocument, id: NodeId): GraphDocument {
  if (!graph.nodes[id]) return graph;
  const nodes = { ...graph.nodes };
  delete nodes[id];
  // A wire to a node that no longer exists is not an edge, it is a leak.
  const edges: Record<string, EdgeInstance> = {};
  for (const [edgeId, edge] of Object.entries(graph.edges)) {
    if (edge.from.node === id || edge.to.node === id) continue;
    edges[edgeId] = edge;
  }
  return { ...graph, nodes, edges, revision: graph.revision + 1 };
}

/**
 * Add a wire. The caller is expected to have run `canConnect` first; this
 * re-checks anyway, because an unvalidated edge corrupts the document and the
 * cost of re-checking is negligible next to that.
 */
export function connect(
  graph: GraphDocument,
  from: PortRef,
  to: PortRef,
  resolvePort: PortResolver,
): { graph: GraphDocument; edge: EdgeInstance } | {
  graph: GraphDocument;
  refusal: ConnectionRefusal;
} {
  const refusal = canConnect(graph, from, to, resolvePort);
  if (refusal) return { graph, refusal };

  const adjacency = buildAdjacency(graph);
  const order = edgesInto(adjacency, to.node, to.port).length;
  // Deterministic id: the same wire in the same graph always gets the same id,
  // which keeps saved documents diffable.
  const edge: EdgeInstance = {
    id: asEdgeId(`e_${digest({ from, to }, "edge").slice(0, 12)}`),
    from,
    to,
    order,
  };
  return {
    graph: {
      ...graph,
      edges: { ...graph.edges, [edge.id]: edge },
      revision: graph.revision + 1,
    },
    edge,
  };
}

export function disconnect(graph: GraphDocument, id: EdgeId): GraphDocument {
  if (!graph.edges[id]) return graph;
  const edges = { ...graph.edges };
  delete edges[id];
  return { ...graph, edges, revision: graph.revision + 1 };
}

// ===========================================================================
// Cache keys
// ===========================================================================

/**
 * The content address of a node's output.
 *
 * It folds in the node type, its unconnected values, its mute state, its slice
 * index, and — recursively — the digest of every upstream node. Two nodes with
 * the same digest are guaranteed to produce the same pixels, so the digest is
 * the cache key.
 *
 * Position is deliberately *excluded*: dragging a card across the canvas must
 * not invalidate a two-minute render.
 */
export function nodeDigest(
  graph: GraphDocument,
  id: NodeId,
  memo: Map<NodeId, string> = new Map(),
): string {
  const cached = memo.get(id);
  if (cached !== undefined) return cached;
  const node = graph.nodes[id];
  if (!node) return digest({ missing: id }, "node");

  // Guard against being called on a cyclic document: mark in-progress so a
  // loop terminates with a stable sentinel instead of recursing forever.
  memo.set(id, digest({ pending: id }, "node"));

  const adjacency = buildAdjacency(graph);
  const upstream = (adjacency.incoming.get(id) ?? []).map((edge) => ({
    port: edge.to.port,
    order: edge.order,
    source: nodeDigest(graph, edge.from.node, memo),
    sourcePort: edge.from.port,
  }));
  upstream.sort((a, b) => a.port === b.port ? a.order - b.order : (a.port < b.port ? -1 : 1));

  const result = digest(
    {
      type: node.type,
      values: node.values,
      muted: node.state === "muted",
      slice: node.stack?.slice ?? null,
      upstream,
    },
    "node",
  );
  memo.set(id, result);
  return result;
}
