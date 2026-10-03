import { PIPELINE_NODE_DEFS } from '@/lib/pipeline/catalog';
import type { PipelineEdge, PipelineNode, PipelineStageId } from '@/types/pipeline';
import { LANE_WIDTH, laneX } from '@/stores/pipelineStore';
import { COLLAPSED_HEADER } from './laneFrames';

export interface GroupCycle {
  key: string;
  side: 'in' | 'out';
  role: 'external' | 'internal' | 'empty';
  type: string;
  nodeId: string;
  portId: string;
  edgeIds: string[];
}

export interface GroupWiring {
  inputs: GroupCycle[];
  outputs: GroupCycle[];
  external: number;
  internal: number;
}

/** Lift every member port onto the closed group, and count links that stay inside or leave. */
export function wiringFor(
  memberIds: readonly string[],
  nodes: readonly PipelineNode[],
  edges: readonly PipelineEdge[],
): GroupWiring {
  const members = new Set(memberIds);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const inputs: GroupCycle[] = [];
  const outputs: GroupCycle[] = [];
  let external = 0;
  let internal = 0;

  for (const edge of edges) {
    const fromIn = members.has(edge.from);
    const toIn = members.has(edge.to);
    if (fromIn && toIn) internal += 1;
    else if (fromIn || toIn) external += 1;
  }

  for (const nodeId of memberIds) {
    const node = byId.get(nodeId);
    const def = node ? PIPELINE_NODE_DEFS[node.type] : undefined;
    if (!def) continue;
    for (const port of def.inputs) {
      inputs.push(cycleFor(nodeId, port.id, port.type, 'in', members, edges));
    }
    for (const port of def.outputs) {
      outputs.push(cycleFor(nodeId, port.id, port.type, 'out', members, edges));
    }
  }

  return { inputs, outputs, external, internal };
}

function cycleFor(
  nodeId: string,
  portId: string,
  type: string,
  side: 'in' | 'out',
  members: Set<string>,
  edges: readonly PipelineEdge[],
): GroupCycle {
  const touching = edges.filter((edge) => (
    side === 'in'
      ? edge.to === nodeId && edge.toPort === portId
      : edge.from === nodeId && edge.fromPort === portId
  ));
  const leaves = touching.some((edge) => {
    const other = side === 'in' ? edge.from : edge.to;
    return !members.has(other);
  });
  const stays = touching.some((edge) => {
    const other = side === 'in' ? edge.from : edge.to;
    return members.has(other);
  });
  const role = leaves ? 'external' : stays ? 'internal' : 'empty';
  return {
    key: `${side}:${nodeId}:${portId}`,
    side,
    role,
    type,
    nodeId,
    portId,
    edgeIds: touching.map((edge) => edge.id),
  };
}

/** Where a closed-group cycle sits in scene space. Many cycles share the lane edge and sit closer together. */
export function cyclePointForStage(
  stage: PipelineStageId,
  laneHeight: number,
  side: 'in' | 'out',
  index: number,
  total: number,
): { x: number; y: number } {
  const usable = Math.max(16, laneHeight - COLLAPSED_HEADER - 10);
  const gap = total <= 1 ? 0 : Math.min(15, (usable - 8) / Math.max(1, total - 1));
  return {
    x: laneX(stage) + (side === 'in' ? 8 : LANE_WIDTH - 8),
    y: COLLAPSED_HEADER + 12 + index * gap,
  };
}
