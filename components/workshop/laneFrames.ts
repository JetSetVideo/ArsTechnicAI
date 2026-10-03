import type { PipelineStageId } from '@/types/pipeline';
import { STAGE_ORDER } from '@/lib/pipeline/catalog';
import { laneMembers, showStageLane, type LaneFrame, type LaneNode } from '@/lib/pipeline/lanes';
import { LANE_HEADER, LANE_WIDTH, NODE_GAP, NODE_H, laneX } from '@/stores/pipelineStore';

export interface LaneFrameOptions {
  collapsed?: readonly PipelineStageId[];
  pinned?: readonly PipelineStageId[];
  excludeId?: string | null;
  growStage?: PipelineStageId | null;
}

/** Closed groups keep a short header, then a lip of each card. */
export const COLLAPSED_HEADER = 62;
export const COLLAPSED_STACK_PAD = 12;

export interface FoldedCard {
  shiftX: number;
  /** Bottom edge, measured from the top of the lane. */
  lip: number;
  /** Top of the full card, so the lip is its bottom border. */
  top: number;
  /** Background strength. Lower for cards further back, after the cards in front. */
  alpha: number;
}

/**
 * Background strength of a folded card.
 * Index 0 is the front card. Each card behind it is more transparent, and the
 * alpha is scaled by how much the cards in front already let through, so the
 * stacked transparencies do not add up into a solid block.
 */
export function foldBackgroundAlpha(index: number, count: number): number {
  const front = 0.58;
  const falloff = 0.74;
  const own = front * Math.pow(falloff, index);
  let transmission = 1;
  for (let i = 0; i < index; i += 1) {
    transmission *= 1 - front * Math.pow(falloff, i);
  }
  const accounted = own * (0.5 + 0.5 * transmission);
  return Math.max(0.14, Math.min(0.62, accounted));
}

/**
 * Closed stack. Horizontal steps start small and get smaller for the deepest
 * cards, and smaller still when the group holds more cards. Vertical lips
 * follow the same curve so the bottom borders stay visible without a long stair.
 */
export function collapsedStack(count: number): FoldedCard[] {
  const cards: FoldedCard[] = [];
  let shiftX = 0;
  let lip = 0;
  const crowd = Math.max(0.46, 1 - Math.max(0, count - 2) * 0.06);
  for (let index = 0; index < count; index += 1) {
    const depth = count <= 1 ? 0 : index / (count - 1);
    const stepScale = (1 - depth * 0.62) * crowd;
    const stepX = index === 0 ? 0 : Math.max(1.25, 5 * stepScale);
    const stepY = Math.max(9, 18 * stepScale);
    shiftX += stepX;
    lip += stepY;
    cards.push({
      shiftX,
      lip,
      top: COLLAPSED_HEADER + lip - NODE_H,
      alpha: foldBackgroundAlpha(index, count),
    });
  }
  return cards;
}

export function collapsedLaneHeight(count: number): number {
  if (count <= 0) return COLLAPSED_HEADER;
  const stack = collapsedStack(count);
  return COLLAPSED_HEADER + stack[stack.length - 1].lip + COLLAPSED_STACK_PAD;
}

/** Border height that hugs the stacked members. An empty pinned group is only its header. */
export function laneFrameHeight(count: number, collapsed: boolean): number {
  if (collapsed) return collapsedLaneHeight(count);
  if (count <= 0) return LANE_HEADER + 8;
  return LANE_HEADER + count * (NODE_H + NODE_GAP) + 8;
}

export function visibleLaneFrames(
  nodes: readonly LaneNode[],
  options: LaneFrameOptions = {},
): LaneFrame[] {
  const collapsed = options.collapsed ?? [];
  const pinned = options.pinned ?? [];
  const resting = options.excludeId ? nodes.filter((node) => node.id !== options.excludeId) : nodes;
  const dragged = options.excludeId ? nodes.find((node) => node.id === options.excludeId) : undefined;
  const sticky = dragged && dragged.inLane !== false ? dragged.stage : null;
  return STAGE_ORDER
    .filter((stage) => (
      pinned.includes(stage)
      || stage === sticky
      || stage === options.growStage
      || showStageLane(resting, stage)
    ))
    .map((stage) => {
      const count = laneMembers(resting, stage).length + (options.growStage === stage && !collapsed.includes(stage) ? 1 : 0);
      return {
        stage,
        x: laneX(stage),
        y: 0,
        w: LANE_WIDTH,
        h: laneFrameHeight(count, collapsed.includes(stage)),
      };
    });
}
