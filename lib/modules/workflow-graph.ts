// ============================================================
// ARS TECHNICAI — Workflow Graph Type & Validation (COMFY-001)
// Full WorkflowGraph type with metadata, validation, 
// import/export, and ComfyUI compatibility layer.
// ============================================================

import type { ModuleDef } from '@/types/module';
import { moduleRegistry } from './registry';

// ─── Core Types ─────────────────────────────────────────────────────────

export interface WorkflowGraph {
  version: '1.0.0';
  id: string;
  name: string;
  description: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  groups: WorkflowGraphGroup[];
  metadata: WorkflowGraphMetadata;
}

export interface WorkflowGraphNode {
  id: string;
  moduleId: string;
  title: string;
  x: number;
  y: number;
  width?: number;
  params: Record<string, unknown>;
  status: 'idle' | 'queued' | 'running' | 'done' | 'error';
  result?: Record<string, unknown>;
  error?: string;
  progress?: number;
  collapsed?: boolean;
  color?: string;
}

export interface WorkflowGraphEdge {
  id: string;
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
  label?: string;
}

export interface WorkflowGraphGroup {
  id: string;
  name: string;
  color: string;
  nodeIds: string[];
  collapsed: boolean;
  boundingBox: { x: number; y: number; width: number; height: number };
}

export interface WorkflowGraphMetadata {
  tags: string[];
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
  requiredModules: string[];
  thumbnail?: string;
  source?: 'arstechnic' | 'comfyui' | 'manual';
  comfyuiOriginalName?: string;
}

// ─── Validation ──────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'MISSING_MODULE' | 'INVALID_PORT' | 'TYPE_MISMATCH' | 'CYCLE_DETECTED' | 'ISOLATED_NODE' | 'DUPLICATE_ID' | 'ORPHAN_EDGE';
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface ValidationWarning {
  type: 'DEPRECATED_MODULE' | 'LARGE_GRAPH' | 'UNOPTIMIZED_ORDER' | 'MISSING_METADATA';
  message: string;
}

export function validateWorkflowGraph(graph: WorkflowGraph): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check required fields
  if (!graph.nodes || graph.nodes.length === 0) {
    errors.push({ type: 'ISOLATED_NODE', message: 'Workflow has no nodes' });
    return { valid: false, errors, warnings };
  }

  // Build lookup maps
  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
  const nodeIds = new Set(graph.nodes.map(n => n.id));
  const edgeIds = new Set<string>();

  // Check for duplicate node IDs
  if (nodeIds.size !== graph.nodes.length) {
    errors.push({ type: 'DUPLICATE_ID', message: 'Duplicate node IDs detected' });
  }

  // Validate each node
  for (const node of graph.nodes) {
    const module = moduleRegistry.get(node.moduleId);
    if (!module) {
      errors.push({
        type: 'MISSING_MODULE',
        message: `Module "${node.moduleId}" not found in registry`,
        nodeId: node.id,
      });
    }
  }

  // Validate edges
  for (const edge of graph.edges) {
    // Check duplicate edge IDs
    if (edgeIds.has(edge.id)) {
      errors.push({ type: 'DUPLICATE_ID', message: `Duplicate edge ID: ${edge.id}`, edgeId: edge.id });
    }
    edgeIds.add(edge.id);

    // Check orphan edges
    if (!nodeIds.has(edge.fromNodeId)) {
      errors.push({
        type: 'ORPHAN_EDGE',
        message: `Edge references unknown source node "${edge.fromNodeId}"`,
        edgeId: edge.id,
      });
    }
    if (!nodeIds.has(edge.toNodeId)) {
      errors.push({
        type: 'ORPHAN_EDGE',
        message: `Edge references unknown target node "${edge.toNodeId}"`,
        edgeId: edge.id,
      });
    }

    // Check port compatibility (if both nodes and modules exist)
    const fromNode = nodeMap.get(edge.fromNodeId);
    const toNode = nodeMap.get(edge.toNodeId);
    if (fromNode && toNode) {
      const fromModule = moduleRegistry.get(fromNode.moduleId);
      const toModule = moduleRegistry.get(toNode.moduleId);
      if (fromModule && toModule) {
        const fromPort = fromModule.outputs.find(o => o.id === edge.fromPort);
        const toPort = toModule.inputs.find(i => i.id === edge.toPort);

        if (!fromPort) {
          errors.push({
            type: 'INVALID_PORT',
            message: `Output port "${edge.fromPort}" not found on "${fromModule.name}"`,
            nodeId: fromNode.id,
            edgeId: edge.id,
          });
        }
        if (!toPort) {
          errors.push({
            type: 'INVALID_PORT',
            message: `Input port "${edge.toPort}" not found on "${toModule.name}"`,
            nodeId: toNode.id,
            edgeId: edge.id,
          });
        }
        if (fromPort && toPort && fromPort.type !== toPort.type) {
          if (fromPort.type !== 'data' && toPort.type !== 'data') {
            errors.push({
              type: 'TYPE_MISMATCH',
              message: `Port type mismatch: "${fromPort.type}" → "${toPort.type}"`,
              nodeId: toNode.id,
              edgeId: edge.id,
            });
          }
        }
      }
    }
  }

  // Check for isolated nodes (no connections)
  if (graph.nodes.length > 1) {
    const connectedNodes = new Set<string>();
    for (const edge of graph.edges) {
      connectedNodes.add(edge.fromNodeId);
      connectedNodes.add(edge.toNodeId);
    }
    for (const node of graph.nodes) {
      if (!connectedNodes.has(node.id)) {
        errors.push({
          type: 'ISOLATED_NODE',
          message: `Node "${node.title}" is isolated (no connections)`,
          nodeId: node.id,
        });
      }
    }
  }

  // Warnings
  if (graph.nodes.length > 50) {
    warnings.push({ type: 'LARGE_GRAPH', message: `Large workflow (${graph.nodes.length} nodes) may be slow` });
  }
  if (!graph.metadata?.tags || graph.metadata.tags.length === 0) {
    warnings.push({ type: 'MISSING_METADATA', message: 'Workflow has no tags — harder to discover' });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ─── Graph Creation Helpers ──────────────────────────────────────────────

export function createEmptyWorkflow(name: string = 'Untitled Workflow'): WorkflowGraph {
  const id = crypto.randomUUID?.() || `wf-${Date.now()}`;
  return {
    version: '1.0.0',
    id,
    name,
    description: '',
    author: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [],
    edges: [],
    groups: [],
    metadata: {
      tags: [],
      category: 'general',
      difficulty: 'beginner',
      estimatedDuration: 0,
      requiredModules: [],
    },
  };
}

export function addNodeToWorkflow(
  graph: WorkflowGraph,
  moduleId: string,
  title: string,
  x: number,
  y: number,
  params: Record<string, unknown> = {},
): WorkflowGraphNode {
  const node: WorkflowGraphNode = {
    id: crypto.randomUUID?.() || `node-${graph.nodes.length + 1}`,
    moduleId,
    title,
    x, y,
    params,
    status: 'idle',
  };
  graph.nodes.push(node);
  graph.updatedAt = new Date().toISOString();
  graph.metadata.requiredModules = [...new Set([...graph.metadata.requiredModules, moduleId])];
  return node;
}

export function connectNodes(
  graph: WorkflowGraph,
  fromNodeId: string,
  fromPort: string,
  toNodeId: string,
  toPort: string,
): WorkflowGraphEdge {
  const edge: WorkflowGraphEdge = {
    id: crypto.randomUUID?.() || `edge-${graph.edges.length + 1}`,
    fromNodeId, fromPort, toNodeId, toPort,
  };
  graph.edges.push(edge);
  graph.updatedAt = new Date().toISOString();
  return edge;
}
