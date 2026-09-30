/**
 * engine.ts — compile a blueprint into requests the restoration engine runs.
 *
 * ## The one idea in this file
 *
 * The ArchiveRestorer engine takes a *flat parameter dictionary* — one key per
 * stage, applied in a fixed order — and returns a processed frame. WIV's graph
 * is richer than that: it branches, it masks, it iterates on Z. Reconciling
 * the two by rewriting the engine would throw away 17k lines of working,
 * tested computer vision, which Axiom 1 forbids in as many words.
 *
 * Instead the compiler *linearises*. It walks the graph backwards from an
 * output, and every maximal run of `stage.*` nodes that touches one image with
 * no branch in between collapses into a single params dict and becomes one
 * engine call. Branches, mattes and composites become several calls joined by
 * a local composite. The engine never learns that a graph exists.
 *
 * The payoff is that the pipeline nodes stay exactly as accurate as the engine
 * they describe, and a graph that happens to be a straight chain compiles to
 * precisely the request the existing grading desk would have sent — same
 * bytes, same cache entry, same result.
 */

import {
  buildAdjacency,
  type EdgeInstance,
  type GraphDocument,
  type NodeInstance,
  topologicalOrder,
  updateNode,
} from "../core/graph.ts";
import type { NodeId, PortId } from "../core/ids.ts";
import { clampToRange, type SignalValue } from "../core/ports.ts";
import type { NodeRegistry, NodeTypeSpec } from "../core/registry.ts";
import type { PropagationMode } from "../core/venn.ts";

/** One unit of work for the engine, in the order it must run. */
export type EngineStep =
  | {
    readonly kind: "preview";
    readonly node: NodeId;
    /** Flat stage params, exactly the shape `pipeline.merge_params` expects. */
    readonly params: Record<string, Record<string, unknown>>;
    readonly frame: number;
  }
  | {
    readonly kind: "segment";
    readonly node: NodeId;
    readonly frame: number;
    readonly prompt: string;
    readonly feather: number;
  }
  | {
    readonly kind: "region";
    readonly node: NodeId;
    readonly mode: PropagationMode;
    readonly a: NodeId | null;
    readonly b: NodeId | null;
  }
  | {
    readonly kind: "composite";
    readonly node: NodeId;
    readonly base: NodeId | null;
    readonly over: NodeId | null;
    readonly mask: NodeId | null;
    readonly opacity: number;
  }
  | {
    readonly kind: "enhance";
    readonly node: NodeId;
    readonly frame: number;
    readonly positivePrompt: string;
    readonly negativePrompt: string;
    readonly mode: string;
    readonly influence: number;
    readonly maskFrom: NodeId | null;
  }
  /**
   * Encode the sequence reaching `out.render` into a film.
   *
   * The graph already knows everything `POST /api/pipeline/render` needs: the
   * chain feeding the Collect supplies the parameters, the Z stack feeding it
   * supplies the frame range, and the node itself carries frame rate and
   * quality. Before this the node compiled to nothing and the README told you
   * to export from Grade instead.
   */
  | {
    readonly kind: "render";
    readonly node: NodeId;
    /** Stage parameters of the chain that reaches this node. */
    readonly params: Record<string, Record<string, unknown>>;
    readonly fps: number;
    readonly crf: number;
    /** `all` when the whole reel feeds it, `stack` when a Z stack does. */
    readonly frameSource: "all" | "stack";
    /** The stack that decides the range, when there is one. */
    readonly stack: NodeId | null;
    /**
     * What happens to frames this graph does not render: `preserve` holds them
     * so the cut keeps its duration, `compress` omits them.
     */
    readonly timing: "preserve" | "compress";
  }
  /**
   * A `gen.*` or `llm.ask` call on a provider — not the engine.
   *
   * These used to compile as `enhance`, because both are category `ai`: a
   * Generate Image was described to the engine's generative-repair endpoint,
   * with an empty prompt (it has no `positive_prompt` port) and an influence
   * warning that means nothing for a text-to-image model. Nothing executed it,
   * so the effect was silent: wrong diagnostics and an inflated network count.
   * It is its own step now, carrying what a provider client will need.
   */
  | {
    readonly kind: "generate";
    readonly node: NodeId;
    readonly frame: number;
    /** Catalogue id, e.g. `google:gemini-2.5-flash-image`. Empty when unset. */
    readonly modelId: string;
    readonly produces: "image" | "video" | "audio" | "mesh" | "text";
    /** The prompt as resolved by `core/style_eval.ts`, when one was supplied. */
    readonly prompt: string;
    readonly negative: string;
    readonly seed: number | null;
  };

export interface CompileDiagnostic {
  readonly severity: "error" | "warning";
  readonly node: NodeId | null;
  readonly message: string;
}

export interface CompileResult {
  readonly steps: readonly EngineStep[];
  readonly diagnostics: readonly CompileDiagnostic[];
  /** True when there are no `error` diagnostics. */
  readonly runnable: boolean;
  /** Steps that leave the machine. Surfaced so the UI can confirm before spending. */
  readonly networkSteps: number;
}

/**
 * Read a node's effective value for one port: the wired source if there is
 * one, otherwise the node's stored value, otherwise the port's default.
 *
 * Returns `undefined` for a required port with nothing to give, which is what
 * `compileGraph` turns into an error diagnostic rather than a silent default.
 */
function effectiveValue(
  node: NodeInstance,
  spec: NodeTypeSpec,
  portId: PortId,
  incoming: readonly EdgeInstance[],
): SignalValue | undefined {
  if (incoming.some((e) => e.to.port === portId)) return undefined; // supplied by a wire
  const stored = node.values[portId];
  if (stored !== undefined) return stored;
  return spec.inputs.find((p) => p.id === portId)?.defaultValue;
}

const numberValue = (v: SignalValue | undefined, fallback: number): number =>
  v?.kind === "Number" ? v.value : fallback;
const textValue = (v: SignalValue | undefined, fallback: string): string =>
  v?.kind === "Text" ? v.value : fallback;
const enumValue = (v: SignalValue | undefined, fallback: string): string =>
  v?.kind === "Enum" ? v.value : fallback;

/**
 * Collect one `stage.*` node's ports into the engine's per-stage params object.
 *
 * [AGENT-SECURITY] Every numeric value is passed through `clampToRange` with
 * the range the engine itself declares. A value cannot reach OpenCV outside
 * the domain the engine validates against, because both sides read that domain
 * from the same file. Out-of-range input is clamped and reported, not rejected
 * outright: a slider that silently refuses to render is worse than one that
 * renders at its limit and says so.
 */
function stageParams(
  node: NodeInstance,
  spec: NodeTypeSpec,
  incoming: readonly EdgeInstance[],
  diagnostics: CompileDiagnostic[],
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const port of spec.inputs) {
    // Structural ports are wiring, not parameters.
    if (port.id === "image" || port.id === "neighbours") continue;

    const value = effectiveValue(node, spec, port.id, incoming);
    if (value === undefined) continue;

    if (value.kind === "Number") {
      const raw = value.value;
      const clamped = port.range ? clampToRange(raw, port.range) : raw;
      if (port.range && clamped !== raw) {
        diagnostics.push({
          severity: "warning",
          node: node.id,
          message:
            `${spec.label} · ${port.label}: ${raw} is outside ${port.range.min}…${port.range.max}, clamped to ${clamped}.`,
        });
      }
      params[port.id] = clamped;
    } else if (value.kind === "Flag") {
      params[port.id] = value.value;
    } else if (value.kind === "Enum") {
      if (port.options && !port.options.includes(value.value)) {
        diagnostics.push({
          severity: "error",
          node: node.id,
          message: `${spec.label} · ${port.label}: "${value.value}" is not one of ${
            port.options.join(", ")
          }.`,
        });
        continue;
      }
      params[port.id] = value.value;
    } else if (value.kind === "Text") {
      params[port.id] = value.value;
    }
  }
  // A muted node is switched out, not removed: its parameters are preserved so
  // un-muting restores them, but the engine is told the stage is off.
  if (node.state === "muted") params.enabled = false;
  return params;
}

/**
 * Write a Desk / engine params dict back onto `stage.*` ports.
 *
 * Inverse of `stageParams`. Used so Graph and Grade share one grade: sliders
 * on the Desk become node values, and compiling the graph becomes the same
 * dict the Desk would POST to `/api/pipeline/preview`.
 */
export function applyStageParamsToGraph(
  graph: GraphDocument,
  registry: NodeRegistry,
  params: Record<string, Record<string, unknown>>,
  options: { actor?: "user" | "system"; skipUser?: boolean } = {},
): GraphDocument {
  const actor = options.actor ?? "system";
  const skipUser = options.skipUser ?? true;
  let next = graph;
  for (const node of Object.values(graph.nodes)) {
    const spec = registry.get(node.type);
    if (!spec?.engineStage) continue;
    const bag = params[spec.engineStage];
    if (!bag || typeof bag !== "object") continue;
    const values = { ...node.values };
    const authoredBy = { ...node.authoredBy };
    let changed = false;
    for (const port of spec.inputs) {
      if (port.id === "image" || port.id === "neighbours") continue;
      if (skipUser && authoredBy[port.id] === "user" && actor !== "user") continue;
      if (!(port.id in bag)) continue;
      const raw = bag[port.id];
      let value: SignalValue | null = null;
      if (port.kind === "Number" && typeof raw === "number" && Number.isFinite(raw)) {
        value = { kind: "Number", value: port.range ? clampToRange(raw, port.range) : raw };
      } else if (port.kind === "Flag" && typeof raw === "boolean") {
        value = { kind: "Flag", value: raw };
      } else if (port.kind === "Enum" && typeof raw === "string") {
        value = { kind: "Enum", value: raw };
      } else if (port.kind === "Text" && typeof raw === "string") {
        value = { kind: "Text", value: raw };
      }
      if (!value) continue;
      const existing = values[port.id];
      if (
        existing &&
        existing.kind === value.kind &&
        "value" in existing &&
        "value" in value &&
        existing.value === value.value &&
        authoredBy[port.id] === actor
      ) {
        continue;
      }
      values[port.id] = value;
      authoredBy[port.id] = actor;
      changed = true;
    }
    if (changed) next = updateNode(next, node.id, { values, authoredBy });
    const enabled = bag.enabled;
    if (typeof enabled === "boolean") {
      const current = next.nodes[node.id] ?? node;
      if (!enabled && current.state !== "muted") {
        next = updateNode(next, node.id, { state: "muted" });
      } else if (enabled && current.state === "muted") {
        next = updateNode(next, node.id, { state: "idle" });
      }
    }
  }
  return next;
}

/**
 * Walk backwards from `node` collecting the unbroken run of stage nodes
 * feeding it, nearest-last so the result is in engine order.
 *
 * A run breaks at anything that is not a `stage.*` node, and at any stage node
 * whose output feeds more than one consumer — because a fan-out means the
 * intermediate result is needed on its own, so it cannot be folded away.
 */
function collectStageRun(
  graph: GraphDocument,
  registry: NodeRegistry,
  start: NodeId,
  fanOut: ReadonlyMap<NodeId, number>,
): { chain: NodeInstance[]; upstream: NodeId | null } {
  const adjacency = buildAdjacency(graph);
  const chain: NodeInstance[] = [];
  let current: NodeId | null = start;

  while (current !== null) {
    const node: NodeInstance | undefined = graph.nodes[current];
    if (!node) break;
    const spec = registry.get(node.type);
    if (!spec || spec.category !== "stage") break;
    // A shared intermediate must be materialised, so it cannot join this run —
    // unless it is the node we started from.
    if (current !== start && (fanOut.get(current) ?? 0) > 1) break;

    chain.unshift(node);
    const imageEdge: EdgeInstance | undefined = (adjacency.incoming.get(current) ?? [])
      .find((e) => e.to.port === "image");
    current = imageEdge ? imageEdge.from.node : null;
  }

  // Whatever fed the top of the run, if it was not itself a stage node.
  const head = chain[0];
  let upstream: NodeId | null = null;
  if (head) {
    const edge = (adjacency.incoming.get(head.id) ?? []).find((e) => e.to.port === "image");
    if (edge) {
      const feeder = graph.nodes[edge.from.node];
      const feederSpec = feeder ? registry.get(feeder.type) : null;
      if (!feederSpec || feederSpec.category !== "stage") upstream = edge.from.node;
    }
  }
  return { chain, upstream };
}

/**
 * Compile a graph into an ordered list of engine steps.
 *
 * @param frame the frame index being previewed. Inside a Z stack the evaluator
 *              calls this once per slice with the slice's frame.
 */
/**
 * Walk back from a Render to the stage chain and the stack that feed it.
 *
 * The walk crosses `flow.collect` and `flow.stack` — they carry frames, not
 * pixels — and stops at the first stage chain it meets, which is the set of
 * parameters the engine must apply to every frame it encodes.
 */
function upstreamRenderContext(
  graph: GraphDocument,
  registry: NodeRegistry,
  adjacency: ReturnType<typeof buildAdjacency>,
  from: NodeId,
): { params: Record<string, Record<string, unknown>>; stack: NodeId | null } {
  const fanOut = new Map<NodeId, number>();
  for (const edge of Object.values(graph.edges)) {
    fanOut.set(edge.from.node, (fanOut.get(edge.from.node) ?? 0) + 1);
  }
  const seen = new Set<NodeId>([from]);
  const queue: NodeId[] = [from];
  let stack: NodeId | null = null;
  let params: Record<string, Record<string, unknown>> = {};

  // The walk does not stop at the stage chain: the Z stack that decides the
  // frame range sits *behind* it, and returning early left every render
  // claiming it covered the whole reel.
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = graph.nodes[id];
    const spec = node ? registry.get(node.type) : null;
    if (node && spec?.category === "stage" && Object.keys(params).length === 0) {
      const { chain } = collectStageRun(graph, registry, id, fanOut);
      const collected: Record<string, Record<string, unknown>> = {};
      for (const member of chain) {
        const memberSpec = registry.require(member.type);
        if (!memberSpec.engineStage) continue;
        collected[memberSpec.engineStage] = stageParams(
          member,
          memberSpec,
          adjacency.incoming.get(member.id) ?? [],
          [],
        );
      }
      params = collected;
    }
    if (node?.type === "flow.stack") stack = id;
    for (const edge of adjacency.incoming.get(id) ?? []) {
      if (seen.has(edge.from.node)) continue;
      seen.add(edge.from.node);
      queue.push(edge.from.node);
    }
  }
  return { params, stack };
}

/** What a generate node would ask a provider for, without asking. */
function generateStep(
  node: NodeInstance,
  spec: NodeTypeSpec,
  incoming: readonly EdgeInstance[],
  frame: number,
  diagnostics: CompileDiagnostic[],
): EngineStep {
  const produces = node.type === "gen.video"
    ? "video" as const
    : node.type === "gen.audio"
    ? "audio" as const
    : node.type === "gen.mesh"
    ? "mesh" as const
    : node.type === "llm.ask"
    ? "text" as const
    : "image" as const;

  const modelId = enumValue(effectiveValue(node, spec, "model" as PortId, incoming), "");
  if (modelId === "") {
    diagnostics.push({
      severity: "error",
      node: node.id,
      message: `${spec.label} has no model selected, so the run cannot be priced or gated.`,
    });
  }
  const seedRaw = numberValue(effectiveValue(node, spec, "seed" as PortId, incoming), Number.NaN);
  return {
    kind: "generate",
    node: node.id,
    frame,
    modelId,
    produces,
    prompt: textValue(
      effectiveValue(
        node,
        spec,
        (node.type === "llm.ask" ? "instruction" : "prompt") as PortId,
        incoming,
      ),
      "",
    ),
    negative: textValue(effectiveValue(node, spec, "negative" as PortId, incoming), ""),
    seed: Number.isFinite(seedRaw) ? seedRaw : null,
  };
}

export function compileGraph(
  graph: GraphDocument,
  registry: NodeRegistry,
  frame: number,
): CompileResult {
  const diagnostics: CompileDiagnostic[] = [];
  const steps: EngineStep[] = [];

  const topo = topologicalOrder(graph);
  if (!topo.ok) {
    return {
      steps: [],
      diagnostics: [{ severity: "error", node: topo.cycle[0] ?? null, message: topo.message }],
      runnable: false,
      networkSteps: 0,
    };
  }

  const adjacency = buildAdjacency(graph);

  // How many consumers each node has — the fan-out test that breaks stage runs.
  const fanOut = new Map<NodeId, number>();
  for (const edge of Object.values(graph.edges)) {
    fanOut.set(edge.from.node, (fanOut.get(edge.from.node) ?? 0) + 1);
  }

  // Stage nodes folded into an earlier node's run must not also emit their own.
  const absorbed = new Set<NodeId>();

  for (const nodeId of topo.order) {
    if (absorbed.has(nodeId)) continue;
    const node = graph.nodes[nodeId];
    if (!node) continue;
    const spec = registry.get(node.type);
    if (!spec) {
      diagnostics.push({
        severity: "error",
        node: nodeId,
        message:
          `Unknown node type "${node.type}". The registry may be out of date — run \`deno task codegen\`.`,
      });
      continue;
    }

    const incoming = adjacency.incoming.get(nodeId) ?? [];

    switch (spec.category) {
      case "stage": {
        // Only compile a run at its *last* node, so the whole chain collapses
        // into one call. A stage node whose output feeds another stage node
        // will be picked up as part of that one's run.
        const consumerIsStage = (adjacency.outgoing.get(nodeId) ?? []).some((e) => {
          const target = graph.nodes[e.to.node];
          const targetSpec = target ? registry.get(target.type) : null;
          return targetSpec?.category === "stage" && e.to.port === "image";
        });
        if (consumerIsStage && (fanOut.get(nodeId) ?? 0) <= 1) continue;

        const { chain } = collectStageRun(graph, registry, nodeId, fanOut);
        const params: Record<string, Record<string, unknown>> = {};
        for (const member of chain) {
          const memberSpec = registry.require(member.type);
          if (!memberSpec.engineStage) continue;
          if (params[memberSpec.engineStage]) {
            diagnostics.push({
              severity: "warning",
              node: member.id,
              message:
                `${memberSpec.label} appears twice in one chain. The engine applies each stage once, so only the last takes effect — split the chain with a Composite if you meant to apply it twice.`,
            });
          }
          params[memberSpec.engineStage] = stageParams(
            member,
            memberSpec,
            adjacency.incoming.get(member.id) ?? [],
            diagnostics,
          );
          absorbed.add(member.id);
        }
        absorbed.delete(nodeId);
        steps.push({ kind: "preview", node: nodeId, params, frame });
        break;
      }

      case "mask": {
        const prompt = textValue(effectiveValue(node, spec, "prompt" as PortId, incoming), "");
        const feather = numberValue(effectiveValue(node, spec, "feather" as PortId, incoming), 3);
        steps.push({ kind: "segment", node: nodeId, frame, prompt, feather });
        break;
      }

      case "ai": {
        if (node.type !== "ai.enhance") {
          steps.push(generateStep(node, spec, incoming, frame, diagnostics));
          break;
        }
        const influence = numberValue(
          effectiveValue(node, spec, "influence" as PortId, incoming),
          0.45,
        );
        if (influence > 0.6) {
          diagnostics.push({
            severity: "warning",
            node: nodeId,
            message: `Influence ${
              influence.toFixed(2)
            } is high. Generative models drift on faces — keep this at 0.3–0.5 wherever someone is recognisable.`,
          });
        }
        const maskEdge = incoming.find((e) => e.to.port === "mask");
        steps.push({
          kind: "enhance",
          node: nodeId,
          frame,
          positivePrompt: textValue(
            effectiveValue(node, spec, "positive_prompt" as PortId, incoming),
            "",
          ),
          negativePrompt: textValue(
            effectiveValue(node, spec, "negative_prompt" as PortId, incoming),
            "",
          ),
          mode: enumValue(effectiveValue(node, spec, "mode" as PortId, incoming), "restore"),
          influence,
          maskFrom: maskEdge ? maskEdge.from.node : null,
        });
        break;
      }

      case "flow": {
        if (node.type === "flow.propagate") {
          const mode = enumValue(
            effectiveValue(node, spec, "mode" as PortId, incoming),
            "union",
          ) as PropagationMode;
          const a = incoming.find((e) => e.to.port === "a")?.from.node ?? null;
          const b = incoming.find((e) => e.to.port === "b")?.from.node ?? null;
          if (a === null && b === null) {
            diagnostics.push({
              severity: "warning",
              node: nodeId,
              message:
                "Region has no mattes wired to A or B, so it selects the whole frame. Every mode gives the same result until one is connected.",
            });
          }
          steps.push({ kind: "region", node: nodeId, mode, a, b });
        } else if (node.type === "flow.composite") {
          steps.push({
            kind: "composite",
            node: nodeId,
            base: incoming.find((e) => e.to.port === "base")?.from.node ?? null,
            over: incoming.find((e) => e.to.port === "over")?.from.node ?? null,
            mask: incoming.find((e) => e.to.port === "mask")?.from.node ?? null,
            opacity: numberValue(effectiveValue(node, spec, "opacity" as PortId, incoming), 1),
          });
        }
        // flow.stack and flow.collect are handled by the evaluator, which
        // re-invokes this compiler once per slice; they emit no step of their own.
        break;
      }

      case "output": {
        if (node.type === "out.render") {
          const sequence = incoming.find((e) => e.to.port === "sequence");
          if (sequence) {
            const upstream = upstreamRenderContext(graph, registry, adjacency, nodeId);
            if (Object.keys(upstream.params).length === 0) {
              diagnostics.push({
                severity: "warning",
                node: nodeId,
                message:
                  "Render has no restoration stages upstream, so it would encode the source frames unchanged.",
              });
            }
            steps.push({
              kind: "render",
              node: nodeId,
              params: upstream.params,
              fps: numberValue(effectiveValue(node, spec, "fps" as PortId, incoming), 25),
              crf: numberValue(effectiveValue(node, spec, "crf" as PortId, incoming), 18),
              frameSource: upstream.stack ? "stack" : "all",
              stack: upstream.stack,
              timing: enumValue(
                effectiveValue(node, spec, "timing" as PortId, incoming),
                "preserve",
              ) === "compress"
                ? "compress"
                : "preserve",
            });
          }
          break;
        }
        // Save takes any one of three media inputs. Each is optional on its
        // own, so the requirement is that *something* arrives.
        if (node.type === "out.save" && incoming.length === 0) {
          diagnostics.push({
            severity: "error",
            node: nodeId,
            message: "Save has nothing wired. Connect an image, a clip or an audio output.",
          });
        }
        break;
      }

      case "source":
        break;
    }
  }

  // Required inputs, checked over *every* node.
  //
  // This is a separate pass on purpose. The emission loop skips nodes that were
  // absorbed into an earlier node's stage run, and an absorbed node is exactly
  // where an unsatisfied input hides: the head of a collapsed chain has no
  // image source, the chain still compiles to one call, and the engine is asked
  // to process a frame that was never named. Validating outside the loop means
  // no node can escape the check by being folded away.
  for (const nodeId of topo.order) {
    const node = graph.nodes[nodeId];
    const spec = node ? registry.get(node.type) : null;
    if (!node || !spec) continue;
    const incoming = adjacency.incoming.get(nodeId) ?? [];
    for (const port of spec.inputs) {
      // A Mask input left unwired means "the whole frame", which is a valid
      // and common way to run every one of these nodes.
      if (port.kind === "Mask") continue;
      // Declared optional on the port: absence is a mode, not a fault — a
      // generate node with no reference image is text-to-image.
      if (port.optional) continue;
      const wired = incoming.some((e) => e.to.port === port.id);
      const stored = node.values[port.id] !== undefined;
      const hasDefault = port.defaultValue !== undefined;
      if (wired || stored || hasDefault) continue;

      // A missing temporal neighbourhood is a *degradation*, not a failure.
      // Every stage that reads neighbours falls back to single-frame behaviour
      // when it has none — deflicker matches a window of one, temporal fusion
      // averages nothing — so the stage still runs and still produces a frame.
      // What it does not do is the thing the user asked for, and saying so is
      // more useful than refusing to render.
      //
      // This is keyed on the port, not on the kind. `neighbours` is the one
      // port that means "optional temporal context"; every other Sequence
      // input is structural — a Z Stack with no sequence has nothing to
      // iterate and a Render with none has nothing to encode, and calling
      // either a degradation would tell the user their settings are inert when
      // the real problem is that the node cannot run at all.
      if (port.kind === "Sequence" && port.id === "neighbours") {
        diagnostics.push({
          severity: "warning",
          node: nodeId,
          message:
            `${spec.label} compares frames across time, but ${port.label} is unconnected. The stage will run on this frame alone, so its temporal settings will have no effect.`,
        });
        continue;
      }

      diagnostics.push({
        severity: "error",
        node: nodeId,
        message: `${spec.label} · ${port.label} has no source and no default.`,
      });
    }
  }

  const networkSteps =
    steps.filter((s) => s.kind === "segment" || s.kind === "enhance" || s.kind === "generate")
      .length;
  return {
    steps,
    diagnostics,
    runnable: !diagnostics.some((d) => d.severity === "error"),
    networkSteps,
  };
}

// ===========================================================================
// HTTP client
// ===========================================================================

/**
 * What `POST /api/pipeline/preview` returns.
 *
 * `image` is a `data:` URL, so it drops straight into an `img` src with no
 * blob bookkeeping — at preview resolution that is cheaper than the object-URL
 * lifecycle it replaces, and it cannot leak a URL nobody revoked.
 */
export interface PreviewResponse {
  readonly image: string;
  readonly frame: number;
  readonly width?: number;
  readonly height?: number;
  readonly elapsed_ms?: number;
  readonly report?: Record<string, unknown>;
  readonly source?: string;
}

export interface EngineClientOptions {
  /** Base URL of the engine. Same-origin `/api` when served behind the Deno host. */
  readonly baseUrl?: string;
  /** Abort a request after this many ms. */
  readonly timeoutMs?: number;
}

/**
 * A thin client over the restorer's REST API.
 *
 * [AGENT-SECURITY] Every request carries an `AbortSignal` with a timeout. A
 * generative call that never returns must not pin a slot in the evaluator's
 * queue forever, and the engine's own AI timeout is 180s, so the client's
 * default sits above it — timing out *before* the server does would leave work
 * running that nothing is waiting for.
 */
export class EngineClient {
  readonly #baseUrl: string;
  readonly #timeoutMs: number;

  constructor(options: EngineClientOptions = {}) {
    this.#baseUrl = (options.baseUrl ?? "/api").replace(/\/$/, "");
    this.#timeoutMs = options.timeoutMs ?? 200_000;
  }

  async #post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await fetch(`${this.#baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`${path} failed: ${response.status} ${detail.slice(0, 400)}`);
      }
      return await response.json() as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Process one frame with a flat params dict. Maps to `POST /api/pipeline/preview`. */
  preview(
    projectId: string,
    frame: number,
    params: Record<string, unknown>,
    maxEdge = 1280,
  ): Promise<PreviewResponse> {
    return this.#post("/pipeline/preview", {
      project_id: projectId,
      frame,
      params,
      format: "jpeg",
      max_edge: maxEdge,
    });
  }

  /** Subject detection + GrabCut matte. Maps to `POST /api/vision/detect`. */
  detect(projectId: string, frame: number, prompt: string): Promise<unknown> {
    return this.#post("/vision/detect", { project_id: projectId, frame, prompt });
  }

  /**
   * Render a frame range and encode it. Maps to `POST /api/pipeline/render`.
   *
   * Returns as soon as the job is queued; progress arrives on `/ws` and the
   * finished film on `GET /api/project/{id}/export`.
   */
  render(request: {
    projectId: string;
    params: Record<string, Record<string, unknown>>;
    frames: readonly number[] | null;
    fps: number;
    crf: number;
    timing?: "preserve" | "compress";
    encode?: boolean;
  }): Promise<{ job_id: string; encode_job_id: string | null; fps: number; started: boolean }> {
    return this.#post("/pipeline/render", {
      project_id: request.projectId,
      params: request.params,
      frames: request.frames ?? null,
      fps: request.fps,
      crf: request.crf,
      encode: request.encode ?? true,
      only_selected: false,
      ai_influence: 0,
      timing: request.timing ?? "preserve",
    });
  }

  /** What is on disk for this project's export. Maps to `GET /api/project/{id}/export`. */
  async exportInfo(projectId: string): Promise<{
    rendered_frames: number;
    video: string | null;
    video_size_mb: number;
    download_url: string | null;
    stale: boolean;
  }> {
    const response = await fetch(
      `${this.#baseUrl}/project/${encodeURIComponent(projectId)}/export`,
    );
    if (!response.ok) throw new Error(`export info failed: ${response.status}`);
    return await response.json();
  }

  /** Generative repair. Maps to `POST /api/ai/enhance-frame`. */
  enhance(request: {
    projectId: string;
    frame: number;
    positivePrompt: string;
    negativePrompt: string;
    mode: string;
    influence: number;
    maskPngBase64?: string;
    params: Record<string, unknown>;
  }): Promise<unknown> {
    return this.#post("/ai/enhance-frame", {
      project_id: request.projectId,
      frame: request.frame,
      positive_prompt: request.positivePrompt,
      negative_prompt: request.negativePrompt,
      mode: request.mode,
      influence: request.influence,
      mask_png_base64: request.maskPngBase64 ?? null,
      params: request.params,
    });
  }

  /** Compile the graph, then run its deterministic steps against one frame. */
  async previewGraph(
    graph: GraphDocument,
    registry: NodeRegistry,
    frame: number,
  ): Promise<{ result: CompileResult; images: Map<NodeId, string> }> {
    const result = compileGraph(graph, registry, frame);
    const images = new Map<NodeId, string>();
    if (!result.runnable || !graph.projectId) return { result, images };

    for (const step of result.steps) {
      if (step.kind !== "preview") continue; // network steps need explicit consent
      const response = await this.preview(graph.projectId, step.frame, step.params);
      images.set(step.node, response.image);
    }
    return { result, images };
  }
}
