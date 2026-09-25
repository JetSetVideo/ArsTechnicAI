/**
 * evaluator.ts — running a graph, and running it once per depth slice.
 *
 * `compileGraph` turns a blueprint into engine calls for *one* frame. This is
 * the loop that drives it along the Z axis: for each slice of a stack, compile
 * at that slice's frame and run only the steps inside the stack's body.
 *
 * Three properties this has to have, none of which is optional:
 *
 *   * **Bounded concurrency.** A 200-slice stack must not open 200 sockets.
 *     The engine is a single Python process doing OpenCV work in a thread
 *     pool; flooding it makes every slice slower and the UI unresponsive.
 *   * **Cancellable.** A stack evaluation takes minutes. A user who changes
 *     their mind must not have to wait for it, and the work already done must
 *     not be thrown away.
 *   * **Reports as it goes.** Progress is per slice, not a spinner, because
 *     the interesting failure — one frame in the middle that the engine
 *     refuses — is invisible in a spinner.
 */

import { buildAdjacency, type GraphDocument, type NodeInstance } from "../core/graph.ts";
import type { NodeId } from "../core/ids.ts";
import type { NodeRegistry } from "../core/registry.ts";
import { resolveStackScope, type StackScope } from "../core/scope.ts";
import {
  type CompileDiagnostic,
  type CompileResult,
  type EngineStep,
  compileGraph,
  type EngineClient,
} from "./engine.ts";

/** One frame's worth of result, as the engine returned it. */
export interface FrameResult {
  readonly frame: number;
  /** `data:` URL, directly usable as an `img` src. */
  readonly image: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly elapsedMs: number;
  /** Measured effect of the pipeline on this frame, from the engine. */
  readonly report: Readonly<Record<string, unknown>>;
}

/** What one slice of a stack produced. */
export interface SliceResult {
  readonly sliceIndex: number;
  readonly frame: number;
  /** Result per body node that produced one. Empty when the slice failed. */
  readonly outputs: ReadonlyMap<NodeId, FrameResult>;
  readonly error: string | null;
}

export interface StackRunProgress {
  readonly done: number;
  readonly total: number;
  readonly lastFrame: number;
  readonly failures: number;
}

export interface StackRunOptions {
  /** How many slices may be in flight at once. */
  readonly concurrency?: number;
  /** Refuse to start a run larger than this. */
  readonly maxSlices?: number;
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: StackRunProgress) => void;
}

export interface StackRunResult {
  readonly scope: StackScope;
  readonly slices: readonly SliceResult[];
  readonly diagnostics: readonly CompileDiagnostic[];
  readonly elapsedMs: number;
  readonly cancelled: boolean;
  /** Slices dropped because the run exceeded `maxSlices`. */
  readonly truncated: number;
}

/**
 * Default concurrency.
 *
 * Four, not "as many as there are cores". The engine does its CV work in a
 * thread pool that is already using the cores; the limit here exists to keep
 * the *request queue* short so a cancel takes effect promptly, and to stop a
 * long run from starving the interactive single-frame preview.
 */
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_MAX_SLICES = 240;

/**
 * Run one slice: compile the graph at this frame, execute the body's steps.
 *
 * Only `preview` steps run. Network steps are compiled and reported but never
 * executed here — a stack evaluation over 200 slices would otherwise be 200
 * paid generative calls fired by one click, which is precisely the kind of
 * thing that must require an explicit act each time.
 */
async function runSlice(
  graph: GraphDocument,
  registry: NodeRegistry,
  client: EngineClient,
  scope: StackScope,
  sliceIndex: number,
  frame: number,
  collectDiagnostics: CompileDiagnostic[],
): Promise<SliceResult> {
  const outputs = new Map<NodeId, FrameResult>();
  if (!graph.projectId) {
    return { sliceIndex, frame, outputs, error: "No project is bound to this blueprint." };
  }

  const compiled = compileGraph(graph, registry, frame);
  // Diagnostics are identical on every slice — the graph does not change — so
  // gather them once rather than returning 200 copies of the same warning.
  if (sliceIndex === 0) collectDiagnostics.push(...compiled.diagnostics);
  if (!compiled.runnable) {
    return { sliceIndex, frame, outputs, error: "The graph has errors; fix them first." };
  }

  const inBody = new Set(scope.body);
  try {
    for (const step of compiled.steps) {
      if (step.kind !== "preview") continue;
      if (!inBody.has(step.node)) continue;
      const response = await client.preview(graph.projectId, frame, step.params);
      outputs.set(step.node, {
        frame,
        image: response.image,
        widthPx: response.width ?? 0,
        heightPx: response.height ?? 0,
        elapsedMs: response.elapsed_ms ?? 0,
        report: response.report ?? {},
      });
    }
    return { sliceIndex, frame, outputs, error: null };
  } catch (error) {
    return {
      sliceIndex,
      frame,
      outputs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Evaluate every slice of a stack.
 *
 * Slices run through a fixed-size worker pool rather than `Promise.all` over
 * the whole list: `Promise.all` would issue every request immediately, which
 * is exactly the flood the concurrency limit exists to prevent.
 *
 * Results come back in slice order regardless of completion order, because the
 * depth strip draws them by position and out-of-order arrival would make the
 * carousel shuffle as it filled.
 */
export async function evaluateStack(
  graph: GraphDocument,
  registry: NodeRegistry,
  client: EngineClient,
  stackNode: NodeId,
  frames: readonly number[],
  options: StackRunOptions = {},
): Promise<StackRunResult> {
  const started = performance.now();
  const scope = resolveStackScope(graph, stackNode);
  const diagnostics: CompileDiagnostic[] = [];

  if (scope.problem) {
    return {
      scope,
      slices: [],
      diagnostics: [{ severity: "error", node: stackNode, message: scope.problem }],
      elapsedMs: 0,
      cancelled: false,
      truncated: 0,
    };
  }

  const maxSlices = Math.max(1, options.maxSlices ?? DEFAULT_MAX_SLICES);
  const truncated = Math.max(0, frames.length - maxSlices);
  const planned = frames.slice(0, maxSlices);

  const results = new Array<SliceResult | undefined>(planned.length);
  const concurrency = Math.max(1, Math.min(options.concurrency ?? DEFAULT_CONCURRENCY, 16));

  let next = 0;
  let done = 0;
  let failures = 0;
  let cancelled = false;

  const worker = async (): Promise<void> => {
    for (;;) {
      if (options.signal?.aborted) {
        cancelled = true;
        return;
      }
      const index = next++;
      if (index >= planned.length) return;
      const frame = planned[index]!;

      const result = await runSlice(
        graph,
        registry,
        client,
        scope,
        index,
        frame,
        diagnostics,
      );
      results[index] = result;
      done++;
      if (result.error) failures++;
      options.onProgress?.({ done, total: planned.length, lastFrame: frame, failures });
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, planned.length) }, worker));

  return {
    scope,
    // Drop the holes a cancel leaves rather than returning `undefined` entries
    // the caller would have to guard on every access.
    slices: results.filter((r): r is SliceResult => r !== undefined),
    diagnostics,
    elapsedMs: Math.round(performance.now() - started),
    cancelled,
    truncated,
  };
}

/**
 * Ancestors of `seed`, including itself.
 *
 * Same walk Run uses, kept here so This-frame can compile one finished chain
 * even when another branch on the canvas is still unwired.
 */
function upstreamIds(graph: GraphDocument, seed: NodeId): Set<NodeId> {
  const adjacency = buildAdjacency(graph);
  const wanted = new Set<NodeId>();
  const queue: NodeId[] = [seed];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (wanted.has(id)) continue;
    wanted.add(id);
    for (const edge of adjacency.incoming.get(id) ?? []) queue.push(edge.from.node);
  }
  return wanted;
}

function sliceGraph(graph: GraphDocument, keep: ReadonlySet<NodeId>): GraphDocument {
  const nodes: Record<string, NodeInstance> = {};
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (keep.has(node.id)) nodes[id] = node;
  }
  const edges: Record<string, GraphDocument["edges"][string]> = {};
  for (const [id, edge] of Object.entries(graph.edges)) {
    if (keep.has(edge.from.node) && keep.has(edge.to.node)) edges[id] = edge;
  }
  const live = new Set<string>();
  for (const node of Object.values(nodes)) {
    if (node.stack) live.add(node.stack.id);
  }
  const stacks: Record<string, GraphDocument["stacks"][string]> = {};
  for (const [id, stack] of Object.entries(graph.stacks)) {
    if (live.has(id)) stacks[id] = stack;
  }
  return { ...graph, nodes, edges, stacks };
}

/**
 * Compile This-frame work.
 *
 * A dangling unwired node used to mark the *whole* graph unrunnable, so the
 * Preview button did nothing on any canvas being built. Finished stage chains
 * still compile on their own.
 */
function previewCompile(
  graph: GraphDocument,
  registry: NodeRegistry,
  frame: number,
): CompileResult {
  const whole = compileGraph(graph, registry, frame);
  if (whole.runnable) return whole;

  const steps: EngineStep[] = [];
  const seen = new Set<string>();
  for (const node of Object.values(graph.nodes)) {
    if (registry.get(node.type)?.category !== "stage") continue;
    const part = compileGraph(sliceGraph(graph, upstreamIds(graph, node.id)), registry, frame);
    if (!part.runnable) continue;
    for (const step of part.steps) {
      if (step.kind !== "preview" || seen.has(step.node)) continue;
      seen.add(step.node);
      steps.push(step);
    }
  }
  return {
    steps,
    diagnostics: whole.diagnostics,
    runnable: steps.length > 0,
    networkSteps: whole.networkSteps,
  };
}

/**
 * Run the graph once, at one frame, and return every node's result.
 *
 * The single-frame path the "This frame" button uses. Unlike `evaluateStack` it
 * runs every local `preview` step, not just a stack body. Unwired branches do
 * not block finished ones.
 */
export async function evaluateFrame(
  graph: GraphDocument,
  registry: NodeRegistry,
  client: EngineClient,
  frame: number,
): Promise<{
  outputs: Map<NodeId, FrameResult>;
  diagnostics: readonly CompileDiagnostic[];
  runnable: boolean;
  networkSteps: number;
}> {
  const compiled = previewCompile(graph, registry, frame);
  const outputs = new Map<NodeId, FrameResult>();
  if (!graph.projectId || compiled.steps.every((s) => s.kind !== "preview")) {
    return {
      outputs,
      diagnostics: compiled.diagnostics,
      runnable: compiled.runnable,
      networkSteps: compiled.networkSteps,
    };
  }

  for (const step of compiled.steps) {
    if (step.kind !== "preview") continue;
    const response = await client.preview(graph.projectId, step.frame, step.params);
    outputs.set(step.node, {
      frame: step.frame,
      image: response.image,
      widthPx: response.width ?? 0,
      heightPx: response.height ?? 0,
      elapsedMs: response.elapsed_ms ?? 0,
      report: response.report ?? {},
    });
  }
  return {
    outputs,
    diagnostics: compiled.diagnostics,
    runnable: true,
    networkSteps: compiled.networkSteps,
  };
}
