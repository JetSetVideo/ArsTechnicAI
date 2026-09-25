/**
 * scope.ts — what lies inside a Z stack.
 *
 * The 2.5D model has no loop edges: a loop edge is a cycle, and cycles are
 * refused. Iteration is expressed spatially instead — a `flow.stack` node opens
 * a depth axis, and everything downstream of it is evaluated once per slice
 * until a `flow.collect` node closes it again.
 *
 * That makes "which nodes are inside the stack" a real question with a real
 * answer, and this module answers it. Get it wrong in one direction and a
 * grade outside the loop is recomputed 300 times; get it wrong in the other
 * and a stage inside the loop is computed once and smeared across every frame.
 *
 * ## The rule
 *
 * A node is in the body of stack *S* when it is reachable forward from *S* and
 * every path from *S* to it stays clear of a `flow.collect`. Reachability alone
 * is not enough: the node *after* a collect is downstream of the stack but
 * outside it, because collect is where the per-slice results become one
 * sequence again.
 */

import { buildAdjacency, type GraphDocument } from "./graph.ts";
import type { NodeId } from "./ids.ts";

export const STACK_OPEN = "flow.stack";
export const STACK_CLOSE = "flow.collect";

export interface StackScope {
  /** The `flow.stack` node that opens this scope. */
  readonly open: NodeId;
  /** The `flow.collect` nodes that close it. May be empty, or several. */
  readonly closes: readonly NodeId[];
  /** Nodes evaluated once per slice, in dependency order. */
  readonly body: readonly NodeId[];
  /** Why this scope cannot be evaluated, or `null` when it can. */
  readonly problem: string | null;
}

/**
 * Resolve the body of one stack.
 *
 * Walks forward from the stack node, refusing to cross a `flow.collect` and
 * refusing to enter another stack — a stack inside a stack is a second depth
 * axis, and this canvas draws one. Nesting is rejected explicitly rather than
 * producing a body that silently spans both.
 */
export function resolveStackScope(graph: GraphDocument, open: NodeId): StackScope {
  const openNode = graph.nodes[open];
  if (!openNode || openNode.type !== STACK_OPEN) {
    return { open, closes: [], body: [], problem: "That node does not open a stack." };
  }

  const adjacency = buildAdjacency(graph);
  const body: NodeId[] = [];
  const closes: NodeId[] = [];
  const seen = new Set<NodeId>([open]);
  const queue: NodeId[] = [open];
  let nested: NodeId | null = null;

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of adjacency.outgoing.get(current) ?? []) {
      const next = edge.to.node;
      if (seen.has(next)) continue;
      const node = graph.nodes[next];
      if (!node) continue;

      if (node.type === STACK_CLOSE) {
        // The boundary itself belongs to the stack — it runs per slice to
        // gather that slice's result — but nothing past it does.
        seen.add(next);
        closes.push(next);
        body.push(next);
        continue;
      }
      if (node.type === STACK_OPEN) {
        nested = next;
        continue;
      }
      seen.add(next);
      body.push(next);
      queue.push(next);
    }
  }

  let problem: string | null = null;
  if (nested) {
    problem = "This stack contains another stack. The canvas draws one depth axis, " +
      "so nest them by collecting the inner stack before opening the outer one.";
  } else if (body.length === 0) {
    problem = "Nothing is wired to this stack, so there is nothing to iterate.";
  } else if (closes.length === 0) {
    problem = "This stack has no Collect node, so its per-slice results have nowhere to go. " +
      "Add one and wire the last node of the body into it.";
  }

  // Return the body in the graph's own evaluation order so a caller can run it
  // without re-sorting.
  const order = new Map<NodeId, number>();
  Object.keys(graph.nodes).forEach((id, i) => order.set(id as NodeId, i));
  body.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));

  return { open, closes, body, problem };
}

/** Every stack in the graph, each with its resolved body. */
export function allStackScopes(graph: GraphDocument): StackScope[] {
  return Object.values(graph.nodes)
    .filter((n) => n.type === STACK_OPEN)
    .map((n) => resolveStackScope(graph, n.id));
}

/**
 * Which frames a stack iterates.
 *
 * Bounded by `limit` because a stack over a 6000-frame reel would otherwise
 * queue 6000 engine calls from a single click. The caller is told how many
 * were dropped rather than silently receiving a truncated list.
 */
export function stackFrames(
  options: {
    start: number;
    count: number;
    stride: number;
    /** Total frames available in the bound sequence. */
    available: number;
    limit: number;
  },
): { frames: number[]; truncated: number } {
  const stride = Math.max(1, Math.floor(options.stride));
  const start = Math.max(0, Math.floor(options.start));
  const available = Math.max(0, Math.floor(options.available));
  // `count` of 0 means "to the end of the sequence".
  const wanted = options.count > 0
    ? Math.floor(options.count)
    : Math.ceil(Math.max(0, available - start) / stride);

  const frames: number[] = [];
  for (let i = 0; i < wanted; i++) {
    const frame = start + i * stride;
    if (frame >= available) break;
    frames.push(frame);
  }
  const limit = Math.max(1, Math.floor(options.limit));
  if (frames.length <= limit) return { frames, truncated: 0 };
  return { frames: frames.slice(0, limit), truncated: frames.length - limit };
}
