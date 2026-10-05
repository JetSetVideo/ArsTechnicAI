import { rectsOverlap } from './lanes';
import { NODE_H, NODE_W } from '@/stores/pipelineStore';

/**
 * Default gap is wide enough to grab the wire between two cards.
 * The frame can shrink until the gap hits the minimum.
 */
export const CLUSTER_GAP_X = 72;
export const CLUSTER_GAP_Y = 46;
export const CLUSTER_GAP_MIN_X = 28;
export const CLUSTER_GAP_MIN_Y = 20;
/** Inset from the side of the plate to the cards. */
export const CLUSTER_PAD_X = 16;
export const CLUSTER_PAD_BOTTOM = 14;
/** Title band. The cards start just under its bottom rule. */
export const CLUSTER_HEADER = 36;
export const CLUSTER_PAD_TOP = CLUSTER_HEADER + 18;

export interface ClusterRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ClusterEdgeName = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface PackedCluster {
  /** Node positions inside the plate, already inset by the padding. */
  positions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
}

/** Left-to-right columns from the links. Unlinked cards share the first column. */
export function clusterColumns(
  ids: string[],
  edges: readonly { from: string; to: string }[],
): string[][] {
  if (ids.length === 0) return [];
  const indeg = new Map(ids.map((id) => [id, 0]));
  const outs = new Map(ids.map((id) => [id, [] as string[]]));
  for (const edge of edges) {
    if (!indeg.has(edge.from) || !indeg.has(edge.to)) continue;
    indeg.set(edge.to, (indeg.get(edge.to) ?? 0) + 1);
    outs.get(edge.from)?.push(edge.to);
  }

  const layer = new Map<string, number>();
  const queue = ids.filter((id) => (indeg.get(id) ?? 0) === 0);
  if (queue.length === 0) queue.push(ids[0]);
  for (const id of queue) layer.set(id, 0);
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const next of outs.get(id) ?? []) {
      layer.set(next, Math.max(layer.get(next) ?? 0, (layer.get(id) ?? 0) + 1));
      indeg.set(next, (indeg.get(next) ?? 1) - 1);
      if ((indeg.get(next) ?? 0) === 0) queue.push(next);
    }
  }
  for (const id of ids) if (!layer.has(id)) layer.set(id, 0);

  const columns = new Map<number, string[]>();
  for (const id of ids) {
    const column = layer.get(id) ?? 0;
    const members = columns.get(column) ?? [];
    members.push(id);
    columns.set(column, members);
  }
  return [...columns.keys()].sort((a, b) => a - b).map((column) => columns.get(column) ?? []);
}

function span(count: number, item: number, gap: number): number {
  return count * item + Math.max(0, count - 1) * gap;
}

/**
 * Lay a workflow out left to right along its links, with room to grab the
 * wire and a tight margin inside the colored group.
 */
export function packCluster(
  ids: string[],
  edges: readonly { from: string; to: string }[],
): PackedCluster {
  const positions = new Map<string, { x: number; y: number }>();
  const columns = clusterColumns(ids, edges);
  if (columns.length === 0) {
    return { positions, width: CLUSTER_PAD_X * 2, height: CLUSTER_PAD_TOP + CLUSTER_PAD_BOTTOM };
  }
  let maxRows = 1;
  columns.forEach((members, columnIndex) => {
    maxRows = Math.max(maxRows, members.length);
    members.forEach((id, row) => {
      positions.set(id, {
        x: CLUSTER_PAD_X + columnIndex * (NODE_W + CLUSTER_GAP_X),
        y: CLUSTER_PAD_TOP + row * (NODE_H + CLUSTER_GAP_Y),
      });
    });
  });
  return {
    positions,
    width: CLUSTER_PAD_X * 2 + span(columns.length, NODE_W, CLUSTER_GAP_X),
    height: CLUSTER_PAD_TOP + CLUSTER_PAD_BOTTOM + span(maxRows, NODE_H, CLUSTER_GAP_Y),
  };
}

/** Smallest plate that still keeps the minimum gap and the header. */
export function minClusterSize(
  ids: string[],
  edges: readonly { from: string; to: string }[],
): { w: number; h: number } {
  const columns = clusterColumns(ids, edges);
  const cols = Math.max(1, columns.length);
  const rows = Math.max(1, ...columns.map((members) => members.length));
  return {
    w: CLUSTER_PAD_X * 2 + span(cols, NODE_W, CLUSTER_GAP_MIN_X),
    h: CLUSTER_PAD_TOP + CLUSTER_PAD_BOTTOM + span(rows, NODE_H, CLUSTER_GAP_MIN_Y),
  };
}

/**
 * Place cards inside a plate. Extra width and height become space between
 * cards. The gap never drops below the minimum, so the plate cannot shrink
 * past {@link minClusterSize}.
 */
export function placeCluster(
  ids: string[],
  edges: readonly { from: string; to: string }[],
  frame: ClusterRect,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const columns = clusterColumns(ids, edges);
  if (columns.length === 0) return positions;
  const rows = Math.max(1, ...columns.map((members) => members.length));
  const innerW = frame.w - CLUSTER_PAD_X * 2;
  const innerH = frame.h - CLUSTER_PAD_TOP - CLUSTER_PAD_BOTTOM;
  const gapX = columns.length <= 1
    ? 0
    : Math.max(CLUSTER_GAP_MIN_X, (innerW - columns.length * NODE_W) / (columns.length - 1));
  const gapY = rows <= 1
    ? 0
    : Math.max(CLUSTER_GAP_MIN_Y, (innerH - rows * NODE_H) / (rows - 1));
  columns.forEach((members, columnIndex) => {
    members.forEach((id, row) => {
      positions.set(id, {
        x: frame.x + CLUSTER_PAD_X + columnIndex * (NODE_W + gapX),
        y: frame.y + CLUSTER_PAD_TOP + row * (NODE_H + gapY),
      });
    });
  });
  return positions;
}

/** Drag one side or corner. The plate stops at `min`. */
export function resizeClusterFrame(
  start: ClusterRect,
  edge: ClusterEdgeName,
  dx: number,
  dy: number,
  min: { w: number; h: number },
): ClusterRect {
  let { x, y, w, h } = start;
  if (edge.includes('e')) w = Math.max(min.w, start.w + dx);
  if (edge.includes('s')) h = Math.max(min.h, start.h + dy);
  if (edge.includes('w')) {
    w = Math.max(min.w, start.w - dx);
    x = start.x + start.w - w;
  }
  if (edge.includes('n')) {
    h = Math.max(min.h, start.h - dy);
    y = start.y + start.h - h;
  }
  return { x, y, w, h };
}

function overlapRatio(frame: ClusterRect, view: ClusterRect): number {
  const x = Math.max(0, Math.min(frame.x + frame.w, view.x + view.w) - Math.max(frame.x, view.x));
  const y = Math.max(0, Math.min(frame.y + frame.h, view.y + view.h) - Math.max(frame.y, view.y));
  const area = frame.w * frame.h;
  if (area <= 0) return 0;
  return (x * y) / area;
}

/**
 * Put the plate on the point the screen is looking at. If that rectangle
 * crosses nodes already there, step outward and keep the nearest clear spot
 * that still sits in the view.
 */
/** Plate that wraps cards already placed in scene space, using the same padding as the packer. */
export function plateAround(points: readonly { x: number; y: number }[]): ClusterRect {
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x + NODE_W));
  const maxY = Math.max(...points.map((point) => point.y + NODE_H));
  return {
    x: minX - CLUSTER_PAD_X,
    y: minY - CLUSTER_PAD_TOP,
    w: maxX - minX + CLUSTER_PAD_X * 2,
    h: maxY - minY + CLUSTER_PAD_TOP + CLUSTER_PAD_BOTTOM,
  };
}

export function findClusterOrigin(
  center: { x: number; y: number },
  width: number,
  height: number,
  obstacles: readonly ClusterRect[],
  view?: ClusterRect,
): { x: number; y: number } {
  const preferred = { x: center.x - width / 2, y: center.y - height / 2 };
  const clear = (origin: { x: number; y: number }) => !obstacles.some((obstacle) => (
    rectsOverlap({ x: origin.x, y: origin.y, w: width, h: height }, obstacle)
  ));
  if (clear(preferred)) return preferred;

  const step = Math.max(56, Math.round(Math.min(width, height) / 4));
  let best: { x: number; y: number; dist: number; seen: number } | null = null;
  for (let ring = 1; ring <= 18; ring += 1) {
    for (let i = -ring; i <= ring; i += 1) {
      for (let j = -ring; j <= ring; j += 1) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        const origin = { x: preferred.x + i * step, y: preferred.y + j * step };
        if (!clear(origin)) continue;
        const seen = view ? overlapRatio({ ...origin, w: width, h: height }, view) : 1;
        const dist = i * i + j * j;
        const better = !best
          || (seen >= 0.6 && best.seen < 0.6)
          || (seen >= 0.6 === best.seen >= 0.6 && dist < best.dist);
        if (better) best = { ...origin, dist, seen };
      }
    }
    if (best && best.seen >= 0.6) return best;
  }
  return best ?? { x: preferred.x + 19 * step, y: preferred.y };
}
