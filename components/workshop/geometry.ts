import type { PipelineNode } from '@/types/pipeline';
import { PIPELINE_NODE_DEFS } from '@/lib/pipeline/catalog';
import { nodePosition, NODE_W, NODE_H } from '@/stores/pipelineStore';

export const PORT_TOP = 52;
export const PORT_SPACING = 22;

/** Port colors by data type — used for dots and edges. */
export const PORT_COLORS: Record<string, string> = {
  image: '#a855f7', 'image-set': '#c084fc', video: '#ec4899', audio: '#14b8a6',
  text: '#6366f1', script: '#818cf8', shotlist: '#0ea5e9', storyboard: '#38bdf8',
  character: '#22c55e', location: '#4ade80', palette: '#f59e0b', style: '#fbbf24',
  mask: '#94a3b8', subtitle: '#f97316', timeline: '#fb923c', format: '#84cc16',
  data: '#8a8aa2', any: '#cbd5e1',
};

export function inputPortPos(node: PipelineNode, portId: string): { x: number; y: number } | null {
  const def = PIPELINE_NODE_DEFS[node.type];
  if (!def) return null;
  const idx = def.inputs.findIndex((p) => p.id === portId);
  if (idx < 0) return null;
  const { x, y } = nodePosition(node);
  return { x, y: y + PORT_TOP + idx * PORT_SPACING };
}

export function outputPortPos(node: PipelineNode, portId: string): { x: number; y: number } | null {
  const def = PIPELINE_NODE_DEFS[node.type];
  if (!def) return null;
  const idx = def.outputs.findIndex((p) => p.id === portId);
  if (idx < 0) return null;
  const { x, y } = nodePosition(node);
  return { x: x + NODE_W, y: y + PORT_TOP + idx * PORT_SPACING };
}

export function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(48, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export { NODE_W, NODE_H };
