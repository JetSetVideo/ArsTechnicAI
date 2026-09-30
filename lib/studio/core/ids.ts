/**
 * ids.ts — branded identifier types.
 *
 * Every id in this system is a string at runtime, which means the compiler
 * will happily let you pass a NodeId where a PortId belongs. Branding closes
 * that hole at zero runtime cost: the phantom `__brand` field exists only in
 * the type system, so `NodeId` and `PortId` stop being interchangeable while
 * both remain plain strings on the wire and in JSON.
 *
 * [AGENT-VOCABULARY] Every id constructor states *what* it identifies and
 * *where* that thing lives. There is no bare `Id` type by design.
 */

declare const brand: unique symbol;

/** A string tagged with a compile-time-only discriminator. */
export type Branded<TValue extends string, TBrand extends string> = TValue & {
  readonly [brand]: TBrand;
};

/** Identifies one node instance on the blueprint plane. */
export type NodeId = Branded<string, "NodeId">;
/** Identifies one typed socket on one node. Unique within its node only. */
export type PortId = Branded<string, "PortId">;
/** Identifies one directed connection between an output port and an input port. */
export type EdgeId = Branded<string, "EdgeId">;
/** Identifies one Z-axis stack (a loop / iteration carousel). */
export type StackId = Branded<string, "StackId">;
/** Identifies one immutable frame buffer in the lineage store. */
export type BufferId = Branded<string, "BufferId">;
/** Identifies one registered node *type* (not an instance), e.g. "stage.clahe". */
export type NodeTypeId = Branded<string, "NodeTypeId">;
/** Identifies one graph document (one blueprint), 1:1 with a restorer project. */
export type GraphId = Branded<string, "GraphId">;

export const asNodeId = (value: string): NodeId => value as NodeId;
export const asPortId = (value: string): PortId => value as PortId;
export const asEdgeId = (value: string): EdgeId => value as EdgeId;
export const asStackId = (value: string): StackId => value as StackId;
export const asBufferId = (value: string): BufferId => value as BufferId;
export const asNodeTypeId = (value: string): NodeTypeId => value as NodeTypeId;
export const asGraphId = (value: string): GraphId => value as GraphId;

/**
 * A fully-qualified port address. Ports are unique per node, not globally, so
 * an edge endpoint always needs both halves.
 */
export interface PortRef {
  readonly node: NodeId;
  readonly port: PortId;
}

export const portRef = (node: NodeId, port: PortId): PortRef => ({ node, port });

/** Canonical wire form, e.g. `n7:out.image`. Parsed by `parsePortRef`. */
export const formatPortRef = (ref: PortRef): string => `${ref.node}:${ref.port}`;

export function parsePortRef(text: string): PortRef | null {
  const cut = text.indexOf(":");
  if (cut <= 0 || cut === text.length - 1) return null;
  return {
    node: asNodeId(text.slice(0, cut)),
    port: asPortId(text.slice(cut + 1)),
  };
}

/**
 * Monotonic id source. Deterministic within a session, which keeps graph
 * snapshots diffable in tests — `crypto.randomUUID()` would not be.
 *
 * @param prefix short lowercase tag identifying the family, e.g. "n" or "e".
 */
export function createIdSource(prefix: string): () => string {
  let counter = 0;
  return () => `${prefix}${++counter}`;
}
