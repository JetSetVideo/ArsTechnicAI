import type { PipelineStageId } from '@/types/pipeline';

/** A node with `inLane: false` sits on the open canvas and does not form a stage lane. */
export interface LaneNode {
  id: string;
  type: string;
  stage: PipelineStageId;
  inLane?: boolean;
}

export function laneMembers<T extends LaneNode>(nodes: readonly T[], stage: PipelineStageId): T[] {
  return nodes.filter((node) => node.stage === stage && node.inLane !== false);
}

/**
 * The Moodboard lane is the concept stage. A single imported picture does not
 * open it; two imported pictures do. Any other concept node (a generated
 * moodboard, style DNA, …) opens it on its own.
 */
export function showStageLane(nodes: readonly LaneNode[], stage: PipelineStageId): boolean {
  const members = laneMembers(nodes, stage);
  if (members.length === 0) return false;
  if (stage === 'concept' && members.every((node) => node.type === 'image-import') && members.length < 2) {
    return false;
  }
  return true;
}

export interface LaneFrame {
  stage: PipelineStageId;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function stageAtPoint(
  x: number,
  y: number,
  frames: readonly LaneFrame[],
  slack = 0,
): PipelineStageId | null {
  for (const frame of frames) {
    if (x >= frame.x && x <= frame.x + frame.w && y >= frame.y && y <= frame.y + frame.h + slack) {
      return frame.stage;
    }
  }
  return null;
}

/** Where a card's center should land in a stack of `memberCount` lane members. */
export function insertionIndex(
  sceneY: number,
  memberCount: number,
  header: number,
  nodeH: number,
  gap: number,
): number {
  const stride = nodeH + gap;
  for (let index = 0; index < memberCount; index += 1) {
    const mid = header + index * stride + nodeH / 2;
    if (sceneY < mid) return index;
  }
  return memberCount;
}

export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
