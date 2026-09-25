/**
 * catalogue.ts — every node type there is, in one place.
 *
 * There are now three sources of node types and they do not compose the same
 * way:
 *
 *   - `gen/stage_nodes.ts`   generated from the restorer's parameter schema;
 *   - `core/nodes.ts`        hand-authored: sources, set logic, stack control;
 *   - `core/gen_nodes.ts`    hand-authored: references, generation, language.
 *
 * Before this file the combination was written out at three call sites — the
 * canvas and two test files — as `[...STAGE_NODES, ...CORE_NODES]`. Adding a
 * fourth set meant finding all three, and missing one produced a test suite
 * that passed against a registry the app does not have. That is the specific
 * failure this exists to prevent, and it is why `buildRegistry()` is the only
 * supported way to get one.
 */

import { NodeRegistry } from "./registry.ts";
import type { NodeTypeSpec } from "./registry.ts";
import { CORE_NODES } from "./nodes.ts";
import { GENERATION_NODES } from "./gen_nodes.ts";
import { STAGE_NODES } from "../gen/stage_nodes.ts";

/**
 * Order is deliberate: stages first, then the restoration primitives, then the
 * generation half. The palette groups by category rather than by this order,
 * but `NodeRegistry.all()` preserves it, and anything that lists types without
 * grouping — the search results, the runtime check's inventory — reads better
 * with the engine's own vocabulary at the top.
 */
export const ALL_NODES: readonly NodeTypeSpec[] = [
  ...STAGE_NODES,
  ...CORE_NODES,
  ...GENERATION_NODES,
];

/** The registry the canvas runs on. Frozen, so it cannot change under a graph. */
export function buildRegistry(): NodeRegistry {
  return new NodeRegistry(ALL_NODES);
}
