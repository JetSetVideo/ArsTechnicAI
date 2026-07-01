// ============================================================
// ARS TECHNICAI — Workflow I/O Module (COMFY-015)
// Serialize/deserialize workflow graphs as shareable JSON.
// Drag-drop .json files to import workflows. ComfyUI-compatible.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';
import type { ExecutionGraph, GraphNode, GraphEdge } from '../graph-executor';

export const id = 'asm.workflow.io';

export interface WorkflowFile {
  format: 'arstechnic-workflow-v1';
  name: string;
  description: string;
  author: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  graph: ExecutionGraph;
  metadata: {
    tags: string[];
    category: string;
    estimatedDuration: number;
    requiredModules: string[];
    thumbnail?: string;
  };
}

/** Serialize a graph to a shareable JSON workflow file */
export function serializeWorkflow(
  graph: ExecutionGraph,
  name: string,
  description: string = '',
  author: string = '',
  tags: string[] = [],
): WorkflowFile {
  const modules = new Set<string>();
  for (const node of graph.nodes) {
    modules.add(node.moduleId);
  }

  return {
    format: 'arstechnic-workflow-v1',
    name,
    description,
    author,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    graph,
    metadata: {
      tags,
      category: 'general',
      estimatedDuration: graph.nodes.length * 2,
      requiredModules: Array.from(modules),
    },
  };
}

/** Deserialize a workflow JSON file back to an ExecutionGraph */
export function deserializeWorkflow(json: string): { workflow: WorkflowFile; errors: string[] } {
  const errors: string[] = [];

  let parsed: WorkflowFile;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { workflow: null as any, errors: ['Invalid JSON format'] };
  }

  // Validate format
  if (!parsed.format || !parsed.format.startsWith('arstechnic-workflow')) {
    errors.push(`Unknown format: "${parsed.format}". Expected "arstechnic-workflow-v1"`);
  }

  if (!parsed.graph) {
    errors.push('Missing "graph" field');
    return { workflow: parsed, errors };
  }

  if (!parsed.graph.nodes || !Array.isArray(parsed.graph.nodes)) {
    errors.push('Missing or invalid "graph.nodes" array');
  }

  if (!parsed.graph.edges || !Array.isArray(parsed.graph.edges)) {
    errors.push('Missing or invalid "graph.edges" array');
  }

  // Validate node IDs
  const nodeIds = new Set(parsed.graph.nodes?.map((n: any) => n.id) || []);
  for (const edge of parsed.graph.edges || []) {
    if (!nodeIds.has(edge.fromNodeId)) {
      errors.push(`Edge references unknown source node "${edge.fromNodeId}"`);
    }
    if (!nodeIds.has(edge.toNodeId)) {
      errors.push(`Edge references unknown target node "${edge.toNodeId}"`);
    }
  }

  // Check for duplicate IDs
  const ids = (parsed.graph.nodes || []).map((n: any) => n.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0) {
    errors.push(`Duplicate node IDs: ${dupes.join(', ')}`);
  }

  return { workflow: parsed, errors };
}

/** Validate a ComfyUI workflow JSON and convert to ArsTechnicAI format */
export function importComfyUIWorkflow(json: string): { workflow: WorkflowFile; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { workflow: null as any, errors: ['Invalid JSON'], warnings: [] };
  }

  // ComfyUI format: { "nodes": [...], "links": [...], ... } or { "last_node_id": ..., "last_link_id": ..., "nodes": [...], "links": [...] }
  const isComfyUI = parsed.nodes && Array.isArray(parsed.nodes) && 
    parsed.nodes.some((n: any) => n.type && typeof n.type === 'string');

  if (!isComfyUI) {
    errors.push('Not a valid ComfyUI workflow (missing nodes array with type field)');
    return { workflow: null as any, errors, warnings };
  }

  // Map ComfyUI nodes to ArsTechnicAI nodes
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeMap = new Map<number, string>(); // comfy node id → ars node id
  let nodeIdx = 0;

  for (const cn of parsed.nodes) {
    const arsId = `node-${++nodeIdx}`;
    nodeMap.set(cn.id, arsId);

    // Map ComfyUI node types to ArsTechnicAI module IDs
    const moduleId = mapComfyUIType(cn.type);
    if (!moduleId) {
      warnings.push(`ComfyUI node type "${cn.type}" has no direct ArsTechnicAI equivalent — mapped to generic`);
    }

    nodes.push({
      id: arsId,
      moduleId: moduleId || 'gen.image',
      title: cn.title || cn.type || `Node ${nodeIdx}`,
      x: cn.pos?.[0] || 100 + nodeIdx * 250,
      y: cn.pos?.[1] || 200,
      params: cn.widgets_values ? { values: cn.widgets_values } : {},
      status: 'idle',
    });
  }

  // Map ComfyUI links to edges
  for (const link of parsed.links || []) {
    const fromNode = nodeMap.get(link[1] ?? link.origin_id);
    const toNode = nodeMap.get(link[3] ?? link.target_id);
    if (fromNode && toNode) {
      edges.push({
        id: `edge-${link[0] ?? edges.length}`,
        fromNodeId: fromNode,
        fromPort: `output-${link[2] ?? link.origin_slot ?? 0}`,
        toNodeId: toNode,
        toPort: `input-${link[4] ?? link.target_slot ?? 0}`,
      });
    }
  }

  const workflow: WorkflowFile = {
    format: 'arstechnic-workflow-v1',
    name: parsed.extra?.title || 'Imported ComfyUI Workflow',
    description: parsed.extra?.description || `Imported from ComfyUI (${parsed.nodes.length} nodes, ${edges.length} edges)`,
    author: 'ComfyUI Import',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    graph: { nodes, edges },
    metadata: {
      tags: ['imported', 'comfyui'],
      category: 'imported',
      estimatedDuration: nodes.length * 3,
      requiredModules: [...new Set(nodes.map(n => n.moduleId))],
    },
  };

  return { workflow, errors, warnings };
}

/** Map ComfyUI node class names to ArsTechnicAI module IDs */
function mapComfyUIType(comfyType: string): string | null {
  const map: Record<string, string> = {
    'CheckpointLoaderSimple': '3d.load.scene',
    'CLIPTextEncode': 'gen.enhance.prompt',
    'KSampler': 'gen.image',
    'VAEDecode': 'gen.image',
    'SaveImage': 'pub.export',
    'PreviewImage': 'pub.export',
    'LoadImage': 'import.import.file',
    'UpscaleImage': 'gen.upscale',
    'ImageScale': 'edit.resize',
    'ImageBlend': 'edit.blend',
    'ImageCompositeMasked': 'edit.overlay',
    'CropImage': 'edit.crop',
    'Inpaint': 'gen.inpaint',
    'ControlNetApply': 'intel.segment',
    'FaceDetailer': 'intel.detect.faces',
    'LoraLoader': 'gen.style.transfer',
    'EmptyLatentImage': 'gen.image',
  };
  return map[comfyType] || null;
}

/** Download workflow as a .json file */
export function downloadWorkflow(workflow: WorkflowFile, filename?: string): void {
  const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${workflow.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ars-workflow.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Workflow I/O',
  category: 'assembly',
  description: 'Serialize/deserialize workflow graphs as shareable JSON. Import ComfyUI workflows with automatic node type mapping. Drag-drop .json files to load. Export workflows for sharing.',
  inputs: [
    { id: 'workflow', label: 'Workflow Graph', type: 'data', direction: 'input', optional: true },
    { id: 'json', label: 'JSON String', type: 'data', direction: 'input', optional: true },
    { id: 'comfyJson', label: 'ComfyUI JSON', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'serialized', label: 'Serialized JSON', type: 'data', direction: 'output' },
    { id: 'workflow', label: 'Workflow Object', type: 'data', direction: 'output' },
    { id: 'errors', label: 'Validation Errors', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'action', label: 'Action', type: 'enum', options: ['serialize', 'deserialize', 'import-comfyui', 'download'], default: 'serialize' },
    { id: 'name', label: 'Workflow Name', type: 'string', default: '' },
    { id: 'description', label: 'Description', type: 'string', default: '' },
    { id: 'author', label: 'Author', type: 'string', default: '' },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const action = (ctx.parameters.action as string) || 'serialize';

    if (action === 'serialize') {
      const graph = ctx.inputs.workflow as ExecutionGraph;
      if (!graph) return { outputs: { serialized: null, errors: ['No workflow graph provided'] } };
      const wf = serializeWorkflow(
        graph,
        (ctx.parameters.name as string) || 'Untitled Workflow',
        (ctx.parameters.description as string) || '',
        (ctx.parameters.author as string) || '',
      );
      return { outputs: { serialized: JSON.stringify(wf, null, 2), workflow: wf, errors: [] } };
    }

    if (action === 'deserialize') {
      const json = (ctx.inputs.json as string) || '';
      const { workflow, errors } = deserializeWorkflow(json);
      return { outputs: { serialized: json, workflow, errors } };
    }

    if (action === 'import-comfyui') {
      const json = (ctx.inputs.comfyJson as string) || (ctx.inputs.json as string) || '';
      const { workflow, errors, warnings } = importComfyUIWorkflow(json);
      return { outputs: { serialized: JSON.stringify(workflow, null, 2), workflow, errors: [...errors, ...warnings] } };
    }

    return { outputs: { serialized: null, workflow: null, errors: [`Unknown action: ${action}`] } };
  },
};
