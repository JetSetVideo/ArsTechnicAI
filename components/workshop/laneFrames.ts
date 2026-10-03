import type { PipelineStageId } from '@/types/pipeline';
import { STAGE_ORDER } from '@/lib/pipeline/catalog';
import { laneMembers, showStageLane, type LaneFrame, type LaneNode } from '@/lib/pipeline/lanes';
import { LANE_HEADER, LANE_WIDTH, NODE_GAP, NODE_H, laneX } from '@/stores/pipelineStore';

export function visibleLaneFrames(
  nodes: readonly LaneNode[],
  collapsed: readonly PipelineStageId[],
): LaneFrame[] {
  return STAGE_ORDER
    .filter((stage) => showStageLane(nodes, stage))
    .map((stage) => {
      const count = Math.max(1, laneMembers(nodes, stage).length);
      const folded = collapsed.includes(stage);
      return {
        stage,
        x: laneX(stage),
        y: 0,
        w: LANE_WIDTH,
        h: folded ? 62 : LANE_HEADER + count * (NODE_H + NODE_GAP) + 20,
      };
    });
}
