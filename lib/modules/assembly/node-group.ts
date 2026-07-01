// ============================================================
// ARS TECHNICAI — Node Group / Sub-Workflow (COMFY-017)
// Collapse multiple nodes into a reusable group with
// exposed input/output ports. Save as sub-workflow template.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';
import { v4 as uuidv4 } from 'uuid';
import type { ExecutionGraph, GraphNode, GraphEdge } from '../graph-executor';

export const id = 'asm.node.group';

export interface NodeGroup {
  id: string;
  name: string;
  description: string;
  internalGraph: ExecutionGraph;
  exposedInputs: ExposedPort[];
  exposedOutputs: ExposedPort[];
  collapsedNodeId: string;     // the single node representing the group
  color: string;
  category: string;
  tags: string[];
  usageCount: number;
  createdAt: number;
}

export interface ExposedPort {
  id: string;
  label: string;
  type: string;
  internalNodeId: string;   // which internal node this port connects to
  internalPortId: string;    // which port on that internal node
}

/** Collapse a subset of nodes into a group */
export function createNodeGroup(
  graph: ExecutionGraph,
  nodeIdsToGroup: string[],
  name: string,
  description: string = '',
  color: string = '#6366f1',
): { group: NodeGroup; remainingGraph: ExecutionGraph } {
  // Collect the nodes being grouped
  const groupNodes = graph.nodes.filter(n => nodeIdsToGroup.includes(n.id));
  const remainingNodes = graph.nodes.filter(n => !nodeIdsToGroup.includes(n.id));

  if (groupNodes.length === 0) {
    throw new Error('No nodes selected for grouping');
  }

  // Find internal edges (both ends inside group) and external edges (crossing boundary)
  const groupNodeIds = new Set(nodeIdsToGroup);
  const internalEdges: GraphEdge[] = [];
  const incomingEdges: GraphEdge[] = [];   // from outside → into group
  const outgoingEdges: GraphEdge[] = [];   // from group → to outside

  for (const edge of graph.edges) {
    const fromInside = groupNodeIds.has(edge.fromNodeId);
    const toInside = groupNodeIds.has(edge.toNodeId);
    if (fromInside && toInside) {
      internalEdges.push(edge);
    } else if (!fromInside && toInside) {
      incomingEdges.push(edge);
    } else if (fromInside && !toInside) {
      outgoingEdges.push(edge);
    }
  }

  // Create exposed input ports from incoming edges
  const exposedInputs: ExposedPort[] = incomingEdges.map((edge, i) => ({
    id: `exposed-in-${i}`,
    label: `Input ${i + 1}`,
    type: 'data',
    internalNodeId: edge.toNodeId,
    internalPortId: edge.toPort,
  }));

  // Create exposed output ports from outgoing edges
  const exposedOutputs: ExposedPort[] = outgoingEdges.map((edge, i) => ({
    id: `exposed-out-${i}`,
    label: `Output ${i + 1}`,
    type: 'data',
    internalNodeId: edge.fromNodeId,
    internalPortId: edge.fromPort,
  }));

  // Create the collapsed group node
  const collapsedId = uuidv4();
  const collapsedNode: GraphNode = {
    id: collapsedId,
    moduleId: 'asm.node.group',
    title: name,
    x: groupNodes.reduce((s, n) => s + n.x, 0) / groupNodes.length,
    y: groupNodes.reduce((s, n) => s + n.y, 0) / groupNodes.length,
    params: { groupName: name, groupDescription: description, internalNodeCount: groupNodes.length },
    status: 'idle',
  };

  // Rebuild edges for remaining graph: external edges now connect to collapsed node
  const newEdges: GraphEdge[] = [];

  // Edges that don't involve grouped nodes stay as-is
  for (const edge of graph.edges) {
    if (!groupNodeIds.has(edge.fromNodeId) && !groupNodeIds.has(edge.toNodeId)) {
      newEdges.push(edge);
    }
  }

  // Incoming edges → connect to collapsed node
  for (const edge of incomingEdges) {
    newEdges.push({
      id: uuidv4(),
      fromNodeId: edge.fromNodeId,
      fromPort: edge.fromPort,
      toNodeId: collapsedId,
      toPort: exposedInputs.find(e => e.internalNodeId === edge.toNodeId && e.internalPortId === edge.toPort)?.id || 'default-in',
    });
  }

  // Outgoing edges → connect from collapsed node
  for (const edge of outgoingEdges) {
    newEdges.push({
      id: uuidv4(),
      fromNodeId: collapsedId,
      fromPort: exposedOutputs.find(e => e.internalNodeId === edge.fromNodeId && e.internalPortId === edge.fromPort)?.id || 'default-out',
      toNodeId: edge.toNodeId,
      toPort: edge.toPort,
    });
  }

  const group: NodeGroup = {
    id: uuidv4(),
    name,
    description,
    internalGraph: { nodes: groupNodes, edges: internalEdges },
    exposedInputs,
    exposedOutputs,
    collapsedNodeId: collapsedId,
    color,
    category: 'custom',
    tags: [],
    usageCount: 0,
    createdAt: Date.now(),
  };

  const remainingGraph: ExecutionGraph = {
    nodes: [...remainingNodes, collapsedNode],
    edges: newEdges,
  };

  return { group, remainingGraph };
}

/** Expand a collapsed group back to its internal nodes */
export function expandNodeGroup(
  graph: ExecutionGraph,
  collapsedNodeId: string,
  group: NodeGroup,
): ExecutionGraph {
  const remainingNodes = graph.nodes.filter(n => n.id !== collapsedNodeId);
  const newNodeIds = new Set(group.internalGraph.nodes.map(n => n.id));

  // Rebuild edges: replace collapsed node edges with original internal/external edges
  const newEdges: GraphEdge[] = [];

  for (const edge of graph.edges) {
    if (edge.fromNodeId === collapsedNodeId) {
      // This was an outgoing edge from the group
      for (const expOut of group.exposedOutputs) {
        newEdges.push({
          id: uuidv4(),
          fromNodeId: expOut.internalNodeId,
          fromPort: expOut.internalPortId,
          toNodeId: edge.toNodeId,
          toPort: edge.toPort,
        });
      }
    } else if (edge.toNodeId === collapsedNodeId) {
      // This was an incoming edge to the group
      for (const expIn of group.exposedInputs) {
        newEdges.push({
          id: uuidv4(),
          fromNodeId: edge.fromNodeId,
          fromPort: edge.fromPort,
          toNodeId: expIn.internalNodeId,
          toPort: expIn.internalPortId,
        });
      }
    } else if (!newNodeIds.has(edge.fromNodeId) && !newNodeIds.has(edge.toNodeId)) {
      // Edge doesn't involve group nodes at all — keep it
      newEdges.push(edge);
    }
  }

  // Add internal edges from the group
  for (const edge of group.internalGraph.edges) {
    newEdges.push({ ...edge, id: edge.id });
  }

  return {
    nodes: [...remainingNodes, ...group.internalGraph.nodes],
    edges: newEdges,
  };
}

// Registry of saved groups (in-memory, could persist to localStorage/DB)
const savedGroups: Map<string, NodeGroup> = new Map();

export function saveGroup(group: NodeGroup): void {
  savedGroups.set(group.id, group);
}

export function getGroup(id: string): NodeGroup | undefined {
  return savedGroups.get(id);
}

export function listGroups(): NodeGroup[] {
  return Array.from(savedGroups.values());
}

export function deleteGroup(id: string): boolean {
  return savedGroups.delete(id);
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Node Group',
  category: 'assembly',
  description: 'Collapse multiple graph nodes into a single reusable group with exposed input/output ports. Save groups as sub-workflow templates. Double-click to expand and edit internals.',
  inputs: [
    { id: 'graph', label: 'Workflow Graph', type: 'data', direction: 'input' },
    { id: 'nodeIds', label: 'Node IDs to Group', type: 'data', direction: 'input' },
  ],
  outputs: [
    { id: 'group', label: 'Node Group', type: 'data', direction: 'output' },
    { id: 'remainingGraph', label: 'Collapsed Graph', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'action', label: 'Action', type: 'enum', options: ['create', 'expand', 'list', 'save', 'delete'], default: 'create' },
    { id: 'groupName', label: 'Group Name', type: 'string', default: '' },
    { id: 'groupDescription', label: 'Description', type: 'string', default: '' },
    { id: 'groupColor', label: 'Color', type: 'color', default: '#6366f1' },
    { id: 'groupId', label: 'Group ID (for expand/delete)', type: 'string', default: '' },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const action = (ctx.parameters.action as string) || 'create';

    if (action === 'list') {
      const groups = listGroups();
      return { outputs: { group: null, remainingGraph: null, groups }, metadata: { count: groups.length } };
    }

    if (action === 'save') {
      const group = ctx.inputs.group as NodeGroup;
      if (!group) return { outputs: { error: 'No group provided' } };
      saveGroup(group);
      return { outputs: { group, savedCount: savedGroups.size } };
    }

    if (action === 'delete') {
      const gid = (ctx.parameters.groupId as string) || '';
      const deleted = deleteGroup(gid);
      return { outputs: { deleted, remainingGroups: savedGroups.size } };
    }

    if (action === 'expand') {
      const gid = (ctx.parameters.groupId as string) || '';
      const group = getGroup(gid);
      if (!group) return { outputs: { error: `Group ${gid} not found` } };
      const graph = ctx.inputs.graph as ExecutionGraph;
      if (!graph) return { outputs: { error: 'No graph provided' } };
      const expanded = expandNodeGroup(graph, group.collapsedNodeId, group);
      return { outputs: { remainingGraph: expanded, group } };
    }

    // Default: create
    const graph = ctx.inputs.graph as ExecutionGraph;
    const nodeIds = (ctx.inputs.nodeIds as string[]) || [];
    if (!graph || nodeIds.length === 0) {
      return { outputs: { error: 'No graph or node IDs provided' } };
    }

    const { group, remainingGraph } = createNodeGroup(
      graph, nodeIds,
      (ctx.parameters.groupName as string) || 'New Group',
      (ctx.parameters.groupDescription as string) || '',
      (ctx.parameters.groupColor as string) || '#6366f1',
    );

    return {
      outputs: { group, remainingGraph },
      metadata: { collapsedNodeCount: nodeIds.length, exposedInputs: group.exposedInputs.length, exposedOutputs: group.exposedOutputs.length },
    };
  },
};
