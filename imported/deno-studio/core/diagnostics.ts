/**
 * diagnostics.ts — what a run *is*, before it happens.
 *
 * `core/providers.ts` already answers "what will this cost in money". That is
 * one column of the pre-run gate. The rest is structural, and a person
 * deciding whether to press Run needs it as much as the price:
 *
 *   - **execution paths** — distinct source-to-sink routes through the scope;
 *   - **loops** — every Z stack, its body, and how many slices it will run;
 *   - **child branches** — where one output fans out to several consumers;
 *   - **evaluations** — the real number of node executions once loops multiply;
 *   - **memory** — peak host RAM for the frame buffers alive at once, and the
 *     VRAM a local model will want;
 *   - **tokens** — for language-model steps, input and output estimates.
 *
 * The gate is also here. Unlike the money consent (which lets free, local runs
 * through), the *structural* gate asks every time the run is non-trivial: the
 * number that surprises people is as often "240 slices × 6 stages" as it is a
 * dollar figure. The confirmation is bound to the report's digest, so widening
 * a stack after confirming asks again.
 */

import { buildAdjacency, type GraphDocument, topologicalOrder } from "./graph.ts";
import type { NodeId } from "./ids.ts";
import { asNodeId } from "./ids.ts";
import type { NodeRegistry } from "./registry.ts";
import { resolveStackScope, STACK_OPEN } from "./scope.ts";
import { estimateRun, formatCost, model, type PlannedCall, type RunEstimate } from "./providers.ts";
import { digest } from "./hash.ts";

/** Frames are held as 8-bit BGR by the engine; RGBA on the canvas. Budget for 4. */
const BYTES_PER_PIXEL = 4;

/** Rough weights-plus-activations footprint of the local models, in MB. */
export const LOCAL_VRAM_MB: Readonly<Record<string, number>> = {
  "comfy:flux-dev": 16_000,
  "comfy:sdxl": 8_000,
  "comfy:wan-2.2": 20_000,
  "comfy:workflow": 8_000,
  "ollama:llama3.2": 2_500,
};

/** Default output-token assumption for an LLM step with no explicit limit. */
const DEFAULT_OUTPUT_TOKENS = 400;

export interface DiagnosticsOptions {
  /** Nodes to run. Their upstream closure is included. Empty ⇒ whole graph. */
  readonly seeds?: readonly NodeId[];
  /** Frames in the bound sequence, for sizing stacks. */
  readonly sequenceLength?: number;
  readonly frameWidth?: number;
  readonly frameHeight?: number;
  /** Per stack node: iterations to run instead of the computed count. */
  readonly iterationOverrides?: Readonly<Record<string, number>>;
  /** Hard ceiling on slices per stack. Mirrors the canvas's 240. */
  readonly sliceLimit?: number;
}

export interface LoopReport {
  readonly stack: string;
  readonly label: string;
  readonly body: readonly string[];
  readonly iterations: number;
  /** Iterations before the limit or an override was applied. */
  readonly requested: number;
  readonly overridden: boolean;
  readonly problem: string | null;
}

export interface StepReport {
  readonly node: string;
  readonly name: string;
  readonly type: string;
  readonly cost: "local" | "filesystem" | "network";
  /** Position in execution order, 0-based. */
  readonly order: number;
  /** Times this node will execute — 1, or a stack's iteration count. */
  readonly runs: number;
  readonly model: string | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly vramMb: number;
}

export interface PreRunReport {
  readonly scope: number;
  readonly order: readonly StepReport[];
  readonly executionPaths: number;
  readonly loops: readonly LoopReport[];
  readonly childBranches: number;
  readonly fanOutNodes: readonly string[];
  readonly evaluations: number;
  readonly memory: {
    readonly frameBytes: number;
    readonly peakRamMb: number;
    readonly peakVramMb: number;
  };
  readonly tokens: { readonly input: number; readonly output: number };
  readonly cost: RunEstimate;
  readonly problems: readonly string[];
  /** Stable over identical structure; the gate token binds to it. */
  readonly digest: string;
}

export interface GateToken {
  readonly digest: string;
  readonly grantedAt: number;
}

export const GATE_TTL_MS = 15 * 60 * 1000;

const numberValue = (v: unknown): number | null =>
  v && typeof v === "object" && "value" in v && typeof (v as { value: unknown }).value === "number"
    ? (v as { value: number }).value
    : null;
const stringValue = (v: unknown): string | null =>
  v && typeof v === "object" && "value" in v && typeof (v as { value: unknown }).value === "string"
    ? (v as { value: string }).value
    : null;

export function preRunReport(
  graph: GraphDocument,
  registry: NodeRegistry,
  options: DiagnosticsOptions = {},
): PreRunReport {
  const problems: string[] = [];
  const adjacency = buildAdjacency(graph);

  // --- scope: the seeds and everything upstream of them ---------------------
  const seeds = options.seeds && options.seeds.length > 0
    ? options.seeds
    : Object.keys(graph.nodes).map(asNodeId);
  const scope = new Set<string>();
  const queue: string[] = [...seeds];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (scope.has(id) || !graph.nodes[id]) continue;
    scope.add(id);
    for (const e of adjacency.incoming.get(asNodeId(id)) ?? []) queue.push(e.from.node);
  }

  const topo = topologicalOrder(graph);
  let ordered: string[];
  if (topo.ok) {
    ordered = topo.order.filter((id) => scope.has(id));
  } else {
    problems.push("The graph has a cycle, so it has no execution order.");
    ordered = [...scope];
  }

  // --- loops ---------------------------------------------------------------
  const limit = Math.max(1, options.sliceLimit ?? 240);
  const loops: LoopReport[] = [];
  const runsOf = new Map<string, number>();
  for (const id of ordered) {
    const node = graph.nodes[id]!;
    if (node.type !== STACK_OPEN) continue;
    const resolved = resolveStackScope(graph, asNodeId(id));
    const stride = Math.max(1, numberValue(node.values.stride) ?? 1);
    const requested = Math.max(1, Math.ceil((options.sequenceLength ?? 1) / stride));
    const override = options.iterationOverrides?.[id];
    const overridden = typeof override === "number" && Number.isFinite(override) && override >= 1;
    const iterations = overridden
      ? Math.min(Math.floor(override!), limit)
      : Math.min(requested, limit);
    if (!overridden && requested > limit) {
      problems.push(`${node.name}: ${requested} slices requested, capped at ${limit}.`);
    }
    if (resolved.problem) problems.push(`${node.name}: ${resolved.problem}`);
    loops.push({
      stack: id,
      label: node.name,
      body: resolved.body.filter((b) => scope.has(b)),
      iterations,
      requested,
      overridden,
      problem: resolved.problem,
    });
    for (const b of resolved.body) runsOf.set(b, (runsOf.get(b) ?? 1) * iterations);
  }

  // --- paths and branches ----------------------------------------------------
  const pathsTo = new Map<string, number>();
  let executionPaths = 0;
  let childBranches = 0;
  const fanOutNodes: string[] = [];
  for (const id of ordered) {
    const inScopeParents = new Set(
      (adjacency.incoming.get(asNodeId(id)) ?? []).map((e) => e.from.node as string)
        .filter((p) => scope.has(p)),
    );
    const count = inScopeParents.size === 0
      ? 1
      : [...inScopeParents].reduce((s, p) => s + (pathsTo.get(p) ?? 0), 0);
    pathsTo.set(id, count);
    const children = new Set(
      (adjacency.outgoing.get(asNodeId(id)) ?? []).map((e) => e.to.node as string)
        .filter((c) => scope.has(c)),
    );
    if (children.size === 0) executionPaths += count;
    if (children.size > 1) {
      childBranches += children.size - 1;
      fanOutNodes.push(id);
    }
  }

  // --- per step --------------------------------------------------------------
  const width = options.frameWidth ?? 1920;
  const height = options.frameHeight ?? 1080;
  const frameBytes = width * height * BYTES_PER_PIXEL;
  const calls: PlannedCall[] = [];
  let tokensIn = 0;
  let tokensOut = 0;
  let peakVram = 0;
  let evaluations = 0;

  const steps: StepReport[] = ordered.map((id, order) => {
    const node = graph.nodes[id]!;
    const spec = registry.get(node.type);
    const runs = runsOf.get(id) ?? 1;
    evaluations += runs;
    const modelId = stringValue(node.values.model);
    const modelSpec = modelId ? model(modelId) : null;
    let inputTokens = 0;
    let outputTokens = 0;
    let vramMb = 0;
    if (spec?.cost === "network" && modelId) {
      calls.push({ modelId, nodeId: id, count: runs });
      if (modelSpec?.produces === "text") {
        const text = ["instruction", "context", "prompt"]
          .map((p) => stringValue(node.values[p]) ?? "")
          .join(" ");
        inputTokens = Math.ceil(text.length / 4) * runs;
        outputTokens = DEFAULT_OUTPUT_TOKENS * runs;
      } else if (modelSpec) {
        const prompt = stringValue(node.values.prompt) ?? "";
        inputTokens = Math.ceil(prompt.length / 4) * runs;
      }
      vramMb = LOCAL_VRAM_MB[modelId] ?? 0;
    }
    if (!spec) problems.push(`${node.name}: unknown node type ${node.type}.`);
    tokensIn += inputTokens;
    tokensOut += outputTokens;
    peakVram = Math.max(peakVram, vramMb);
    return {
      node: id,
      name: node.name,
      type: node.type,
      cost: spec?.cost ?? "local",
      order,
      runs,
      model: modelId,
      inputTokens,
      outputTokens,
      vramMb,
    };
  });

  // Peak RAM: frames alive at once is bounded by the widest topological layer
  // (every node in it holds an output until its consumers run), plus the
  // collected sequence of the largest stack.
  const layer = new Map<string, number>();
  for (const id of ordered) {
    const parents = (adjacency.incoming.get(asNodeId(id)) ?? []).map((e) => e.from.node as string)
      .filter((p) => scope.has(p));
    layer.set(
      id,
      parents.length === 0 ? 0 : 1 + Math.max(...parents.map((p) => layer.get(p) ?? 0)),
    );
  }
  const widths = new Map<number, number>();
  for (const l of layer.values()) widths.set(l, (widths.get(l) ?? 0) + 1);
  const widest = Math.max(0, ...widths.values());
  const collected = Math.max(0, ...loops.map((l) => l.iterations));
  const peakRamMb = Math.round(((widest + collected) * frameBytes) / (1024 * 1024));

  const cost = estimateRun(calls);
  if (cost.unknownModels.length > 0) {
    problems.push(`Unknown models: ${cost.unknownModels.join(", ")}.`);
  }

  const structure = {
    steps: steps.map((s) => [s.node, s.type, s.runs, s.model]),
    edges: Object.values(graph.edges)
      .filter((e) => scope.has(e.from.node) && scope.has(e.to.node))
      .map((e) => `${e.from.node}:${e.from.port}>${e.to.node}:${e.to.port}`)
      .sort(),
    loops: loops.map((l) => [l.stack, l.iterations]),
    frame: [width, height],
    values: ordered.map((id) => [id, graph.nodes[id]!.revision]),
  };

  return {
    scope: scope.size,
    order: steps,
    executionPaths,
    loops,
    childBranches,
    fanOutNodes,
    evaluations,
    memory: { frameBytes, peakRamMb, peakVramMb: peakVram },
    tokens: { input: tokensIn, output: tokensOut },
    cost,
    problems,
    digest: digest(structure, "prerun"),
  };
}

/** Does this run need a confirmation at all? Only an empty run does not. */
export function requiresConfirmation(report: PreRunReport): boolean {
  return report.evaluations > 0;
}

export function confirmRun(report: PreRunReport, now: number = Date.now()): GateToken {
  return { digest: report.digest, grantedAt: now };
}

export type GateVerdict = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** May this run start? Halts until a token for exactly this structure exists. */
export function gateAllows(
  report: PreRunReport,
  token: GateToken | null,
  now: number = Date.now(),
): GateVerdict {
  if (!requiresConfirmation(report)) return { ok: true };
  if (report.problems.some((p) => p.includes("cycle"))) {
    return { ok: false, reason: "The graph has a cycle and cannot run." };
  }
  if (!token) return { ok: false, reason: `Confirm ${summarise(report)} before it runs.` };
  if (token.digest !== report.digest) {
    return { ok: false, reason: "The run changed after it was confirmed. Confirm it again." };
  }
  if (now - token.grantedAt > GATE_TTL_MS) {
    return { ok: false, reason: "That confirmation has expired. Confirm the run again." };
  }
  return { ok: true };
}

/** One line: "14 evaluations · 2 paths · 1 loop ×12 · ~96 MB · free". */
export function summarise(report: PreRunReport): string {
  const parts = [
    `${report.evaluations} evaluation${report.evaluations === 1 ? "" : "s"}`,
    `${report.executionPaths} path${report.executionPaths === 1 ? "" : "s"}`,
  ];
  if (report.loops.length > 0) {
    parts.push(
      report.loops.length === 1
        ? `1 loop ×${report.loops[0]!.iterations}`
        : `${report.loops.length} loops`,
    );
  }
  if (report.childBranches > 0) {
    parts.push(`${report.childBranches} branch${report.childBranches === 1 ? "" : "es"}`);
  }
  parts.push(`~${report.memory.peakRamMb} MB RAM`);
  if (report.memory.peakVramMb > 0) {
    parts.push(`~${Math.round(report.memory.peakVramMb / 1024)} GB VRAM`);
  }
  if (report.tokens.input + report.tokens.output > 0) {
    parts.push(`~${report.tokens.input + report.tokens.output} tokens`);
  }
  parts.push(report.cost.billedCalls > 0 ? formatCost(report.cost.cents) : "free");
  return parts.join(" · ");
}
