/**
 * Blueprints are reusable workshop graphs. They used to sit in their own
 * store with no page. Compiling one produces pipeline nodes and edges the
 * workshop can show; capturing the workshop writes a blueprint back.
 */
import { v4 as uuidv4 } from 'uuid';
import type { Blueprint, BlueprintCategory, BlueprintConnection, BlueprintNode } from '@/types/blueprint';
import type { PipelineEdge, PipelineNode, PipelineStageId } from '@/types/pipeline';
import { PIPELINE_NODE_DEFS, STAGES, defaultParams, portsCompatible } from '@/lib/pipeline/catalog';

export const PENDING_BLUEPRINT_KEY = 'ars:pending-blueprint';

export interface BlueprintSpec {
  id: string;
  name: string;
  description: string;
  category: BlueprintCategory;
  nodes: { key: string; type: string; parameters?: Record<string, unknown> }[];
  links: { from: string; fromPort: string; to: string; toPort: string }[];
}

export interface CompiledBlueprint {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  warnings: string[];
}

/** Graphs a new workspace can open from the home page. Node types are catalog ids. */
export const STARTER_BLUEPRINTS: BlueprintSpec[] = [
  {
    id: 'bp-starter-key-visual',
    name: 'Key visual',
    description: 'Moodboard, style, a crafted prompt, and one hero frame.',
    category: 'image',
    nodes: [
      { key: 'mood', type: 'moodboard-gen' },
      { key: 'style', type: 'style-dna' },
      { key: 'prompt', type: 'prompt-craft' },
      { key: 'key', type: 'keyframe-gen' },
    ],
    links: [
      { from: 'mood', fromPort: 'images', to: 'style', toPort: 'refs' },
      { from: 'mood', fromPort: 'images', to: 'prompt', toPort: 'moodboard' },
      { from: 'style', fromPort: 'style', to: 'key', toPort: 'style' },
      { from: 'prompt', fromPort: 'prompts', to: 'key', toPort: 'prompt' },
    ],
  },
  {
    id: 'bp-starter-spoken-scene',
    name: 'Spoken scene',
    description: 'Logline to script, a still, a motion clip, and dialogue.',
    category: 'video',
    nodes: [
      { key: 'log', type: 'logline-gen' },
      { key: 'script', type: 'script-gen' },
      { key: 'key', type: 'keyframe-gen' },
      { key: 'anim', type: 'image-to-video' },
      { key: 'voice', type: 'dialogue-tts' },
    ],
    links: [
      { from: 'log', fromPort: 'logline', to: 'script', toPort: 'logline' },
      { from: 'script', fromPort: 'script', to: 'key', toPort: 'prompt' },
      { from: 'key', fromPort: 'image', to: 'anim', toPort: 'image' },
      { from: 'script', fromPort: 'script', to: 'voice', toPort: 'script' },
    ],
  },
  {
    id: 'bp-starter-storyboard',
    name: 'Storyboard',
    description: 'Logline, screenplay, shot list, and one board frame.',
    category: 'full-pipeline',
    nodes: [
      { key: 'log', type: 'logline-gen' },
      { key: 'script', type: 'script-gen' },
      { key: 'shots', type: 'shotlist-gen' },
      { key: 'board', type: 'storyboard-frame' },
    ],
    links: [
      { from: 'log', fromPort: 'logline', to: 'script', toPort: 'logline' },
      { from: 'script', fromPort: 'script', to: 'shots', toPort: 'script' },
      { from: 'shots', fromPort: 'shotlist', to: 'board', toPort: 'shotlist' },
    ],
  },
];

export function specToBlueprint(spec: BlueprintSpec): Blueprint {
  const nodes: BlueprintNode[] = spec.nodes.map((node) => ({
    id: node.key,
    moduleId: node.type,
    x: 0,
    y: 0,
    parameters: node.parameters ?? {},
  }));
  const connections: BlueprintConnection[] = spec.links.map((link, index) => ({
    id: `${spec.id}-c${index}`,
    fromNodeId: link.from,
    fromPort: link.fromPort,
    toNodeId: link.to,
    toPort: link.toPort,
  }));
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    category: spec.category,
    nodes,
    connections,
    parameters: [],
    version: '1.0.0',
    createdAt: 0,
    updatedAt: 0,
  };
}

function laneFallback(stage: PipelineStageId, slot: number): { x: number; y: number } {
  const order = STAGES[stage]?.order ?? 0;
  return { x: order * 430 + 24, y: 76 + slot * 256 };
}

/** A blueprint node at 0,0 has not been placed; the workshop lanes it by stage. */
function isUnplaced(node: BlueprintNode): boolean {
  return node.x === 0 && node.y === 0;
}

export function compileBlueprint(bp: Blueprint): CompiledBlueprint {
  const warnings: string[] = [];
  const idMap = new Map<string, string>();
  const slotByStage: Partial<Record<PipelineStageId, number>> = {};
  const nodes: PipelineNode[] = [];

  for (const source of bp.nodes) {
    const def = PIPELINE_NODE_DEFS[source.moduleId];
    if (!def) {
      warnings.push(`Unknown node “${source.moduleId}” was left out.`);
      continue;
    }
    const id = uuidv4();
    idMap.set(source.id, id);
    const slot = slotByStage[def.stage] ?? 0;
    slotByStage[def.stage] = slot + 1;
    const placed = !isUnplaced(source);
    nodes.push({
      id,
      type: source.moduleId,
      stage: def.stage,
      title: def.title,
      slot,
      x: placed ? source.x : undefined,
      y: placed ? source.y : undefined,
      params: { ...defaultParams(def), ...source.parameters },
      status: 'idle',
      variants: [],
    });
  }

  const edges: PipelineEdge[] = [];
  for (const connection of bp.connections) {
    const from = idMap.get(connection.fromNodeId);
    const to = idMap.get(connection.toNodeId);
    if (!from || !to) {
      warnings.push('A link was dropped because its node is not in the workshop catalog.');
      continue;
    }
    const fromNode = nodes.find((node) => node.id === from);
    const toNode = nodes.find((node) => node.id === to);
    const fromDef = fromNode ? PIPELINE_NODE_DEFS[fromNode.type] : undefined;
    const toDef = toNode ? PIPELINE_NODE_DEFS[toNode.type] : undefined;
    const fromPort = fromDef?.outputs.find((port) => port.id === connection.fromPort);
    const toPort = toDef?.inputs.find((port) => port.id === connection.toPort);
    if (!fromPort || !toPort || !portsCompatible(fromPort.type, toPort.type)) {
      warnings.push(`Link ${connection.fromPort} → ${connection.toPort} does not fit and was dropped.`);
      continue;
    }
    edges.push({
      id: uuidv4(),
      from,
      fromPort: connection.fromPort,
      to,
      toPort: connection.toPort,
      type: fromPort.type,
    });
  }

  return { nodes, edges, warnings };
}

export function graphToBlueprint(
  nodes: PipelineNode[],
  edges: PipelineEdge[],
  meta: { name: string; category: BlueprintCategory; description?: string },
): Blueprint {
  const now = Date.now();
  return {
    id: uuidv4(),
    name: meta.name,
    description: meta.description,
    category: meta.category,
    version: '1.0.0',
    createdAt: now,
    updatedAt: now,
    parameters: [],
    nodes: nodes.map((node) => {
      const at = node.x !== undefined && node.y !== undefined
        ? { x: node.x, y: node.y }
        : laneFallback(node.stage, node.slot);
      return {
        id: node.id,
        moduleId: node.type,
        x: at.x,
        y: at.y,
        parameters: { ...node.params },
      };
    }),
    connections: edges.map((edge) => ({
      id: edge.id,
      fromNodeId: edge.from,
      fromPort: edge.fromPort,
      toNodeId: edge.to,
      toPort: edge.toPort,
    })),
  };
}

export function inferCategory(nodes: { type: string }[]): BlueprintCategory {
  const stages = new Set(nodes.map((node) => PIPELINE_NODE_DEFS[node.type]?.stage).filter(Boolean));
  if (stages.has('motion') || stages.has('assembly') || stages.has('delivery')) return 'video';
  if (stages.has('audio') && !stages.has('visual')) return 'audio';
  if (stages.size >= 4) return 'full-pipeline';
  return 'image';
}
