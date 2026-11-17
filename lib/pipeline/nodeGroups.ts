// User groups on the workshop canvas.
//
// A group is a workflow plate (the same titled, foldable, resizable frame a
// blueprint drops): its members share `clusterId`, `clusterTitle`,
// `clusterIcon` and `clusterFrame`. Grouping a rectangle selection therefore
// reuses every plate behaviour that already exists — fold, resize, wiring
// through a folded plate, delete, undo.
//
// Pure functions; the store injects lane compaction so they stay testable.

import { NODE_H, NODE_W, nodePosition } from '@/stores/pipelineStore';
import {
  CLUSTER_PAD_BOTTOM,
  CLUSTER_PAD_TOP,
  CLUSTER_PAD_X,
  findClusterOrigin,
  packCluster,
  type ClusterRect,
} from '@/lib/pipeline/clusterLayout';
import type { PipelineEdge, PipelineNode } from '@/types/pipeline';

export const GROUP_ICON = 'Boxes';

export interface GroupOptions {
  clusterId: string;
  title: string;
  icon?: string;
  edges: readonly Pick<PipelineEdge, 'from' | 'to'>[];
  /** Closes the holes members leave in their stage lanes (store's compactInLane). */
  compact?: (nodes: PipelineNode[]) => PipelineNode[];
}

/** Next free default title: "Group 1", "Group 2", … */
export function nextGroupTitle(nodes: readonly PipelineNode[]): string {
  const used = new Set(nodes.map((node) => node.clusterTitle).filter(Boolean));
  for (let i = 1; ; i += 1) {
    const title = `Group ${i}`;
    if (!used.has(title)) return title;
  }
}

function frameAround(points: readonly { x: number; y: number }[]): ClusterRect {
  const minX = Math.min(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxX = Math.max(...points.map((p) => p.x)) + NODE_W;
  const maxY = Math.max(...points.map((p) => p.y)) + NODE_H;
  return {
    x: minX - CLUSTER_PAD_X,
    y: minY - CLUSTER_PAD_TOP,
    w: maxX - minX + CLUSTER_PAD_X * 2,
    h: maxY - minY + CLUSTER_PAD_TOP + CLUSTER_PAD_BOTTOM,
  };
}

/**
 * Folds the given nodes into one new plate.
 * - Free nodes (already off the lanes) keep their places; the plate wraps them.
 * - If any member came from a stage lane, the members are laid out along their
 *   links and the plate is placed near where they were, clear of other cards.
 * Members leave any plate they were in. Returns the input array when fewer
 * than one known node is given.
 */
export function groupIntoPlate(
  nodes: PipelineNode[],
  ids: readonly string[],
  options: GroupOptions,
): PipelineNode[] {
  const idSet = new Set(ids.filter((id) => nodes.some((node) => node.id === id)));
  if (idSet.size === 0) return nodes;
  const members = nodes.filter((node) => idSet.has(node.id));
  const tag = {
    clusterId: options.clusterId,
    clusterTitle: options.title,
    clusterIcon: options.icon ?? GROUP_ICON,
    clusterCollapsed: false,
  };

  const allFree = members.every((node) => node.inLane === false && node.x !== undefined && node.y !== undefined);
  if (allFree) {
    const frame = frameAround(members.map((node) => ({ x: node.x!, y: node.y! })));
    return nodes.map((node) => (idSet.has(node.id) ? { ...node, ...tag, clusterFrame: frame } : node));
  }

  // Where the selection was, before anything moves.
  const centres = members.map((node) => {
    const at = nodePosition(node);
    return { x: at.x + NODE_W / 2, y: at.y + NODE_H / 2 };
  });
  const centre = {
    x: centres.reduce((sum, p) => sum + p.x, 0) / centres.length,
    y: centres.reduce((sum, p) => sum + p.y, 0) / centres.length,
  };

  const memberIds = members.map((node) => node.id);
  const inner = options.edges.filter((edge) => idSet.has(edge.from) && idSet.has(edge.to));
  const packed = packCluster(memberIds, inner);

  // Lift the members off their lanes first so the lanes close up, then look
  // for room among what is left.
  let next = nodes.map((node) => (idSet.has(node.id)
    ? { ...node, inLane: false as const, x: node.x ?? nodePosition(node).x, y: node.y ?? nodePosition(node).y }
    : node));
  if (options.compact) next = options.compact(next);

  const obstacles: ClusterRect[] = [];
  const seenPlates = new Set<string>();
  for (const node of next) {
    if (idSet.has(node.id)) continue;
    const at = nodePosition(node);
    obstacles.push({ x: at.x - 16, y: at.y - 16, w: NODE_W + 32, h: NODE_H + 32 });
    if (node.clusterId && node.clusterFrame && !seenPlates.has(node.clusterId)) {
      seenPlates.add(node.clusterId);
      obstacles.push(node.clusterFrame);
    }
  }
  const origin = findClusterOrigin(centre, packed.width, packed.height, obstacles);
  const frame = { x: origin.x, y: origin.y, w: packed.width, h: packed.height };

  return next.map((node) => {
    if (!idSet.has(node.id)) return node;
    const at = packed.positions.get(node.id) ?? { x: CLUSTER_PAD_X, y: CLUSTER_PAD_TOP };
    return { ...node, ...tag, inLane: false as const, x: origin.x + at.x, y: origin.y + at.y, clusterFrame: frame };
  });
}

function withoutPlate(node: PipelineNode): PipelineNode {
  const { clusterId: _id, clusterTitle: _title, clusterIcon: _icon, clusterFrame: _frame, clusterCollapsed: _folded, ...rest } = node;
  return { ...rest, inLane: false, x: node.x, y: node.y };
}

/** Dissolves a plate: its cards stay where they are, free on the canvas. */
export function ungroupPlate(nodes: PipelineNode[], clusterId: string): PipelineNode[] {
  if (!nodes.some((node) => node.clusterId === clusterId)) return nodes;
  return nodes.map((node) => (node.clusterId === clusterId ? withoutPlate(node) : node));
}

/** Takes some cards out of whatever plate they are in; they stay where they are. */
export function removeFromPlates(nodes: PipelineNode[], ids: readonly string[]): PipelineNode[] {
  const idSet = new Set(ids);
  if (!nodes.some((node) => idSet.has(node.id) && node.clusterId)) return nodes;
  return nodes.map((node) => (idSet.has(node.id) && node.clusterId ? withoutPlate(node) : node));
}

export function renamePlate(nodes: PipelineNode[], clusterId: string, title: string): PipelineNode[] {
  const clean = title.trim();
  if (!clean || !nodes.some((node) => node.clusterId === clusterId)) return nodes;
  return nodes.map((node) => (node.clusterId === clusterId ? { ...node, clusterTitle: clean } : node));
}

/** The plate every given node belongs to, if they all share exactly one. */
export function sharedPlate(nodes: readonly PipelineNode[], ids: readonly string[]): string | null {
  const plates = new Set(nodes.filter((node) => ids.includes(node.id)).map((node) => node.clusterId ?? ''));
  if (plates.size !== 1) return null;
  const [only] = [...plates];
  return only || null;
}
