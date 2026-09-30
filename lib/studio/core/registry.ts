/**
 * registry.ts — what kinds of node exist, and what each one promises.
 *
 * A `NodeTypeSpec` is a *contract*, not an implementation: it declares the
 * ports, the default card geometry, the accent colour and — critically — how
 * the node compiles into a request the ArchiveRestorer engine understands.
 * Execution lives in the engine; this side only ever describes and routes.
 *
 * [AGENT-VOCABULARY] Type ids are dotted and namespaced: `stage.*` wraps a
 * deterministic CV stage, `source.*` reads footage, `mask.*` produces
 * coverage, `ai.*` calls a generative model, `flow.*` handles set logic and
 * stack control, `out.*` terminates a branch. The namespace is load-bearing —
 * `compileNode` in `bridge/engine.ts` dispatches on it.
 */

import type { NodeTypeId } from "./ids.ts";
import type { PortDirection, PortSpec, SignalKind } from "./ports.ts";

/** Which family a node belongs to. Drives accent colour and compile strategy. */
export type NodeCategory = "source" | "stage" | "mask" | "ai" | "flow" | "output";

/**
 * Accent per category. A node card's header, its port ring and every variable
 * chip it emits read from here, which is the mechanism behind the rule that a
 * chip always matches the card it came from.
 */
export const CATEGORY_COLOUR: Readonly<Record<NodeCategory, string>> = {
  source: "#5cbfa8",
  stage: "#4da3d8",
  mask: "#c76a9f",
  ai: "#9b8cd4",
  flow: "#e8a33d",
  output: "#d9705b",
};

/**
 * How far a node may be trusted to run without asking.
 *
 * [AGENT-SECURITY] `local` is pure OpenCV on already-loaded pixels. `network`
 * leaves the machine and costs money, so the evaluator will not run one as a
 * side effect of an upstream edit — it needs an explicit request. `filesystem`
 * reads paths the user chose. Auto-evaluate on canvas edit is permitted for
 * `local` only; without that split, dragging a slider would fire a paid API
 * call per pointer-move.
 */
export type NodeCost = "local" | "filesystem" | "network";

export interface NodeTypeSpec {
  readonly id: NodeTypeId;
  readonly category: NodeCategory;
  /** Primary typography. The name on the card header. */
  readonly label: string;
  /** One sentence: what this does and when to reach for it. */
  readonly hint: string;
  readonly cost: NodeCost;
  readonly inputs: readonly PortSpec[];
  readonly outputs: readonly PortSpec[];
  /** Default card size in blueprint units. */
  readonly size: { readonly w: number; readonly h: number };
  /**
   * The engine stage this compiles into, for `stage.*` nodes: the key under
   * which its parameters land in the restorer's params dict. `null` for nodes
   * with no direct stage equivalent.
   */
  readonly engineStage: string | null;
}

export const categoryColour = (category: NodeCategory): string => CATEGORY_COLOUR[category];

/**
 * An immutable set of node types, indexed by id.
 *
 * Frozen at construction because port specs are read on every render and every
 * connection check; a registry that could change underneath the graph would
 * make an existing edge's validity time-dependent.
 */
export class NodeRegistry {
  readonly #types: ReadonlyMap<NodeTypeId, NodeTypeSpec>;

  constructor(types: readonly NodeTypeSpec[]) {
    const map = new Map<NodeTypeId, NodeTypeSpec>();
    for (const spec of types) {
      if (map.has(spec.id)) {
        throw new Error(`Duplicate node type id: ${spec.id}`);
      }
      map.set(spec.id, spec);
    }
    this.#types = map;
  }

  get(id: NodeTypeId): NodeTypeSpec | null {
    return this.#types.get(id) ?? null;
  }

  /** Throwing accessor for call sites where a missing type is a bug, not input. */
  require(id: NodeTypeId): NodeTypeSpec {
    const spec = this.#types.get(id);
    if (!spec) throw new Error(`Unknown node type: ${id}`);
    return spec;
  }

  all(): readonly NodeTypeSpec[] {
    return [...this.#types.values()];
  }

  byCategory(category: NodeCategory): readonly NodeTypeSpec[] {
    return this.all().filter((t) => t.category === category);
  }

  /**
   * Resolve one port by id *and direction*.
   *
   * The direction is required, not optional. Nearly every image-processing
   * node names its input and its output `image`, so an id alone is ambiguous —
   * and a lookup that quietly returned whichever came first would resolve the
   * source end of a wire to an input port and refuse every legal connection
   * with "a wire runs from an output to an input". Making the caller state
   * which end it means turns that into an impossible mistake.
   */
  port(id: NodeTypeId, portId: string, direction: PortDirection): PortSpec | null {
    const spec = this.#types.get(id);
    if (!spec) return null;
    const group = direction === "input" ? spec.inputs : spec.outputs;
    return group.find((p) => p.id === portId) ?? null;
  }

  /**
   * Every type with an output that can reach the given input kind.
   *
   * This is what makes "every option is one click away" implementable: drop a
   * wire on empty canvas and the palette that opens is already filtered to the
   * nodes that could legally receive it, ranked, with nothing else in the way.
   */
  producersFor(kind: SignalKind): readonly NodeTypeSpec[] {
    return this.all().filter((t) =>
      t.outputs.some((p) => p.kind === kind || (kind === "Sequence" && p.kind === "Image"))
    );
  }

  consumersOf(kind: SignalKind): readonly NodeTypeSpec[] {
    return this.all().filter((t) =>
      t.inputs.some((p) => p.kind === kind || (p.kind === "Sequence" && kind === "Image"))
    );
  }
}
