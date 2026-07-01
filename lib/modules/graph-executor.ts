// ============================================================
// ARS TECHNICAI — Graph Execution Engine
// ComfyUI-inspired: topological sort → execute nodes in order
// → resolve port connections → capture results per node.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult, PortType } from '@/types/module';
import { moduleRegistry } from '@/lib/modules/registry';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  moduleId: string;       // which module this node runs
  title: string;
  x: number;
  y: number;
  params: Record<string, unknown>;
  status: 'idle' | 'queued' | 'running' | 'done' | 'error';
  result?: Record<string, unknown>;
  error?: string;
  progress?: number;
}

export interface GraphEdge {
  id: string;
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
}

export interface ExecutionGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ExecutionResult {
  nodeId: string;
  status: 'done' | 'error';
  outputs: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

export interface GraphExecutionResult {
  results: ExecutionResult[];
  totalDurationMs: number;
  successCount: number;
  errorCount: number;
  finalOutput?: Record<string, unknown>;
}

// ─── Topological Sort ─────────────────────────────────────────────────────

/** Kahn's algorithm: sort nodes so dependencies come first */
function topologicalSort(graph: ExecutionGraph): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Build edges
  for (const edge of graph.edges) {
    adjacency.get(edge.fromNodeId)?.push(edge.toNodeId);
    inDegree.set(edge.toNodeId, (inDegree.get(edge.toNodeId) || 0) + 1);
  }

  // Start with nodes that have no incoming edges
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) queue.push(nodeId);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const neighbor of adjacency.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  // Cycle detection
  if (sorted.length !== graph.nodes.length) {
    const remaining = graph.nodes.filter(n => !sorted.includes(n.id)).map(n => n.title);
    console.warn('[GraphExecutor] Cycle detected! Remaining nodes:', remaining);
    // Add remaining nodes at end (best-effort)
    for (const n of graph.nodes) {
      if (!sorted.includes(n.id)) sorted.push(n.id);
    }
  }

  return sorted;
}

// ─── Input Resolution ─────────────────────────────────────────────────────

/** Resolve a node's input ports from upstream connected nodes */
function resolveInputs(
  nodeId: string,
  graph: ExecutionGraph,
  results: Map<string, Record<string, unknown>>,
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};

  for (const edge of graph.edges) {
    if (edge.toNodeId === nodeId) {
      const upstreamResult = results.get(edge.fromNodeId);
      if (upstreamResult && upstreamResult[edge.fromPort] !== undefined) {
        inputs[edge.toPort] = upstreamResult[edge.fromPort];
      }
    }
  }

  return inputs;
}

// ─── Main Executor ────────────────────────────────────────────────────────

export async function executeGraph(
  graph: ExecutionGraph,
  onProgress?: (nodeId: string, progress: number, status: string) => void,
  signal?: AbortSignal,
): Promise<GraphExecutionResult> {
  const t0 = performance.now();
  const sorted = topologicalSort(graph);
  const results = new Map<string, Record<string, unknown>>();
  const executionResults: ExecutionResult[] = [];
  let successCount = 0;
  let errorCount = 0;

  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

  for (const nodeId of sorted) {
    if (signal?.aborted) {
      executionResults.push({
        nodeId, status: 'error',
        outputs: {}, error: 'Execution aborted',
        durationMs: 0,
      });
      errorCount++;
      break;
    }

    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const tNode = performance.now();
    onProgress?.(nodeId, 0, 'starting');

    try {
      // Find the module
      const module = moduleRegistry.get(node.moduleId);
      if (!module) {
        throw new Error(`Module "${node.moduleId}" not found in registry`);
      }

      // Resolve inputs from upstream
      const resolvedInputs = resolveInputs(nodeId, graph, results);

      // Build execution context
      const ctx: ModuleContext = {
        inputs: { ...resolvedInputs, ...node.params },
        parameters: node.params,
        signal,
        onProgress: (pct, msg) => {
          onProgress?.(nodeId, pct, msg || 'running');
        },
      };

      // Execute
      onProgress?.(nodeId, 10, 'executing');
      const result = await module.execute(ctx);
      onProgress?.(nodeId, 100, 'done');

      // Store results by output port
      const outputPorts: Record<string, unknown> = {};
      if (result.outputs) {
        Object.assign(outputPorts, result.outputs);
      }
      // Also store under module output port IDs for downstream resolution
      for (const port of module.outputs) {
        if (result.outputs[port.id] !== undefined) {
          outputPorts[port.id] = result.outputs[port.id];
        }
      }

      results.set(nodeId, outputPorts);
      executionResults.push({
        nodeId,
        status: 'done',
        outputs: outputPorts,
        durationMs: Math.round(performance.now() - tNode),
      });
      successCount++;

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      executionResults.push({
        nodeId,
        status: 'error',
        outputs: {},
        error: msg,
        durationMs: Math.round(performance.now() - tNode),
      });
      results.set(nodeId, {}); // Empty result so downstream can still try
      errorCount++;
      onProgress?.(nodeId, 0, 'error');
    }
  }

  // Find final output node (convention: node with type 'output' or last in sorted order)
  const outputNodes = graph.nodes.filter(n => n.moduleId.includes('output') || n.moduleId.includes('export'));
  const finalNode = outputNodes.length > 0 ? outputNodes[outputNodes.length - 1] : null;
  const finalOutput = finalNode ? results.get(finalNode.id) : undefined;

  return {
    results: executionResults,
    totalDurationMs: Math.round(performance.now() - t0),
    successCount,
    errorCount,
    finalOutput,
  };
}

// ─── Graph Validation ─────────────────────────────────────────────────────

export function validateGraph(graph: ExecutionGraph): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (graph.nodes.length === 0) {
    errors.push('Graph has no nodes');
    return { valid: false, errors };
  }

  // Check all modules exist
  for (const node of graph.nodes) {
    if (!moduleRegistry.get(node.moduleId)) {
      errors.push(`Node "${node.title}" references unknown module "${node.moduleId}"`);
    }
  }

  // Check for cycles
  const sorted = topologicalSort(graph);
  if (sorted.length !== graph.nodes.length) {
    errors.push('Graph contains cycles — cannot execute');
  }

  // Check port compatibility on edges
  for (const edge of graph.edges) {
    const fromNode = graph.nodes.find(n => n.id === edge.fromNodeId);
    const toNode = graph.nodes.find(n => n.id === edge.toNodeId);
    if (!fromNode || !toNode) continue;

    const fromModule = moduleRegistry.get(fromNode.moduleId);
    const toModule = moduleRegistry.get(toNode.moduleId);
    if (!fromModule || !toModule) continue;

    const fromPort = fromModule.outputs.find(o => o.id === edge.fromPort);
    const toPort = toModule.inputs.find(i => i.id === edge.toPort);

    if (!fromPort) {
      errors.push(`Edge ${edge.id}: source port "${edge.fromPort}" not found on "${fromNode.title}"`);
    }
    if (!toPort) {
      errors.push(`Edge ${edge.id}: target port "${edge.toPort}" not found on "${toNode.title}"`);
    }
    if (fromPort && toPort && fromPort.type !== toPort.type) {
      // Allow data→anything and anything→data as flexible connections
      if (fromPort.type !== 'data' && toPort.type !== 'data') {
        errors.push(`Edge ${edge.id}: type mismatch — "${fromPort.type}" → "${toPort.type}"`);
      }
    }
  }

  // Check no node is isolated (has at least one connection)
  const connectedNodes = new Set<string>();
  for (const edge of graph.edges) {
    connectedNodes.add(edge.fromNodeId);
    connectedNodes.add(edge.toNodeId);
  }
  const isolated = graph.nodes.filter(n => !connectedNodes.has(n.id));
  if (isolated.length > 0 && graph.nodes.length > 1) {
    for (const n of isolated) {
      errors.push(`Node "${n.title}" is isolated (no connections)`);
    }
  }

  return { valid: errors.length === 0, errors };
}
