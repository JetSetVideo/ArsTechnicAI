import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

// ─── Types ─────────────────────────────────────────────────────────────────

export type NodeType =
  | 'prompt'
  | 'negative'
  | 'generator'
  | 'image-in'
  | 'transform'
  | 'blend'
  | 'output';

export type PortType = 'image' | 'text' | 'number';

export interface NodePort {
  id: string;
  label: string;
  type: PortType;
  direction: 'input' | 'output';
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  title: string;
  x: number;
  y: number;
  width: number;
  data: Record<string, unknown>;
  status: 'idle' | 'running' | 'done' | 'error';
  result?: unknown; // resolved output values by portId
  error?: string;
}

export interface NodeConnection {
  id: string;
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
}

// ─── Node definitions ───────────────────────────────────────────────────────

export interface NodeDef {
  title: string;
  color: string;
  inputs: Omit<NodePort, 'direction'>[];
  outputs: Omit<NodePort, 'direction'>[];
  defaultData: Record<string, unknown>;
  defaultWidth: number;
}

export const NODE_DEFS: Record<NodeType, NodeDef> = {
  prompt: {
    title: 'Prompt',
    color: '#6366f1',
    inputs: [],
    outputs: [{ id: 'prompt', label: 'Prompt', type: 'text' }],
    defaultData: { text: '' },
    defaultWidth: 260,
  },
  negative: {
    title: 'Negative Prompt',
    color: '#ef4444',
    inputs: [],
    outputs: [{ id: 'negative', label: 'Negative', type: 'text' }],
    defaultData: { text: '' },
    defaultWidth: 260,
  },
  generator: {
    title: 'Generate Image',
    color: '#00d4aa',
    inputs: [
      { id: 'prompt', label: 'Prompt', type: 'text' },
      { id: 'negative', label: 'Negative', type: 'text' },
    ],
    outputs: [{ id: 'image', label: 'Image', type: 'image' }],
    defaultData: { width: 1024, height: 1024, model: 'imagen-3.0-generate-001', apiKey: '' },
    defaultWidth: 280,
  },
  'image-in': {
    title: 'Image Input',
    color: '#a855f7',
    inputs: [],
    outputs: [{ id: 'image', label: 'Image', type: 'image' }],
    defaultData: { src: '', name: 'image.png' },
    defaultWidth: 240,
  },
  transform: {
    title: 'Transform',
    color: '#f59e0b',
    inputs: [{ id: 'image', label: 'Image', type: 'image' }],
    outputs: [{ id: 'image', label: 'Image', type: 'image' }],
    defaultData: { scaleX: 1, scaleY: 1, rotation: 0, flipH: false, flipV: false },
    defaultWidth: 240,
  },
  blend: {
    title: 'Blend',
    color: '#ec4899',
    inputs: [
      { id: 'imageA', label: 'Image A', type: 'image' },
      { id: 'imageB', label: 'Image B', type: 'image' },
    ],
    outputs: [{ id: 'image', label: 'Result', type: 'image' }],
    defaultData: { mode: 'source-over', opacity: 0.5 },
    defaultWidth: 240,
  },
  output: {
    title: 'Output',
    color: '#14b8a6',
    inputs: [{ id: 'image', label: 'Image', type: 'image' }],
    outputs: [],
    defaultData: { label: 'Result' },
    defaultWidth: 240,
  },
};

// ─── Store ─────────────────────────────────────────────────────────────────

interface PendingConn {
  nodeId: string;
  port: string;
  direction: 'output';
  portType: PortType;
}

interface NodeState {
  nodes: WorkflowNode[];
  connections: NodeConnection[];
  selectedIds: string[];
  isRunning: boolean;
  pendingConnection: PendingConn | null;

  // Node ops
  addNode: (type: NodeType, x: number, y: number) => WorkflowNode;
  removeNode: (id: string) => void;
  moveNode: (id: string, x: number, y: number) => void;
  updateNodeData: (id: string, key: string, value: unknown) => void;
  setNodeStatus: (id: string, status: WorkflowNode['status'], result?: unknown, error?: string) => void;

  // Connection ops
  startConnection: (nodeId: string, port: string, portType: PortType) => void;
  completeConnection: (toNodeId: string, toPort: string) => boolean;
  cancelConnection: () => void;
  removeConnection: (id: string) => void;
  removeConnectionsForNode: (nodeId: string) => void;

  // Selection
  selectNode: (id: string, additive?: boolean) => void;
  clearSelection: () => void;

  // Workflow ops
  executeWorkflow: (apiKey: string) => Promise<void>;
  clearWorkflow: () => void;
  saveWorkflow: () => string;
  loadWorkflow: (json: string) => void;
}

export const useNodeStore = create<NodeState>((set, get) => ({
  nodes: [],
  connections: [],
  selectedIds: [],
  isRunning: false,
  pendingConnection: null,

  addNode: (type, x, y) => {
    const def = NODE_DEFS[type];
    const node: WorkflowNode = {
      id: uuidv4(),
      type,
      title: def.title,
      x,
      y,
      width: def.defaultWidth,
      data: { ...def.defaultData },
      status: 'idle',
    };
    set((s) => ({ nodes: [...s.nodes, node] }));
    return node;
  },

  removeNode: (id) => {
    get().removeConnectionsForNode(id);
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      selectedIds: s.selectedIds.filter((sid) => sid !== id),
    }));
  },

  moveNode: (id, x, y) => {
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    }));
  },

  updateNodeData: (id, key, value) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n
      ),
    }));
  },

  setNodeStatus: (id, status, result, error) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, status, result: result ?? n.result, error: error ?? n.error } : n
      ),
    }));
  },

  startConnection: (nodeId, port, portType) => {
    set({ pendingConnection: { nodeId, port, direction: 'output', portType } });
  },

  completeConnection: (toNodeId, toPort) => {
    const { pendingConnection, connections } = get();
    if (!pendingConnection) return false;

    // Don't connect to self
    if (pendingConnection.nodeId === toNodeId) {
      set({ pendingConnection: null });
      return false;
    }

    // Remove any existing connection to the same input port
    const filtered = connections.filter(
      (c) => !(c.toNodeId === toNodeId && c.toPort === toPort)
    );

    const conn: NodeConnection = {
      id: uuidv4(),
      fromNodeId: pendingConnection.nodeId,
      fromPort: pendingConnection.port,
      toNodeId,
      toPort,
    };

    set({ connections: [...filtered, conn], pendingConnection: null });
    return true;
  },

  cancelConnection: () => set({ pendingConnection: null }),

  removeConnection: (id) => {
    set((s) => ({ connections: s.connections.filter((c) => c.id !== id) }));
  },

  removeConnectionsForNode: (nodeId) => {
    set((s) => ({
      connections: s.connections.filter(
        (c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId
      ),
    }));
  },

  selectNode: (id, additive = false) => {
    set((s) => ({
      selectedIds: additive
        ? s.selectedIds.includes(id)
          ? s.selectedIds.filter((sid) => sid !== id)
          : [...s.selectedIds, id]
        : [id],
    }));
  },

  clearSelection: () => set({ selectedIds: [] }),

  executeWorkflow: async (apiKey) => {
    const { nodes, connections } = get();
    if (get().isRunning) return;

    set({ isRunning: true });

    // Reset all node statuses
    set((s) => ({
      nodes: s.nodes.map((n) => ({ ...n, status: 'idle', result: undefined, error: undefined })),
    }));

    // Build resolved value map: nodeId -> portId -> value
    const resolved: Record<string, Record<string, unknown>> = {};

    // Helper: get value flowing into a node's input port
    const getInput = (nodeId: string, portId: string): unknown => {
      const conn = connections.find((c) => c.toNodeId === nodeId && c.toPort === portId);
      if (!conn) return undefined;
      return resolved[conn.fromNodeId]?.[conn.fromPort];
    };

    // Topological sort
    const inDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {};
    nodes.forEach((n) => { inDegree[n.id] = 0; adj[n.id] = []; });
    connections.forEach((c) => {
      inDegree[c.toNodeId] = (inDegree[c.toNodeId] || 0) + 1;
      adj[c.fromNodeId].push(c.toNodeId);
    });

    const queue: string[] = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
    const order: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      order.push(id);
      for (const neighbor of adj[id] ?? []) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) queue.push(neighbor);
      }
    }

    // Execute in topological order
    for (const nodeId of order) {
      const node = get().nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      get().setNodeStatus(nodeId, 'running');
      resolved[nodeId] = {};

      try {
        if (node.type === 'prompt') {
          resolved[nodeId]['prompt'] = node.data.text ?? '';
        } else if (node.type === 'negative') {
          resolved[nodeId]['negative'] = node.data.text ?? '';
        } else if (node.type === 'image-in') {
          resolved[nodeId]['image'] = node.data.src ?? '';
        } else if (node.type === 'generator') {
          const prompt = (getInput(nodeId, 'prompt') as string) ?? (node.data.text as string) ?? '';
          const negative = (getInput(nodeId, 'negative') as string) ?? '';
          const effectiveApiKey = (node.data.apiKey as string) || apiKey;

          if (!prompt || !effectiveApiKey) throw new Error('Prompt and API key required');

          const resp = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              negativePrompt: negative,
              width: node.data.width ?? 1024,
              height: node.data.height ?? 1024,
              model: node.data.model ?? 'imagen-3.0-generate-001',
              apiKey: effectiveApiKey,
            }),
          });

          if (!resp.ok) throw new Error(`Generation failed: ${resp.status}`);
          const data = await resp.json();
          resolved[nodeId]['image'] = data.dataUrl;
        } else if (node.type === 'transform') {
          const srcImage = getInput(nodeId, 'image') as string;
          if (!srcImage) throw new Error('No image input');

          const result = await applyTransform(srcImage, {
            scaleX: (node.data.scaleX as number) ?? 1,
            scaleY: (node.data.scaleY as number) ?? 1,
            rotation: (node.data.rotation as number) ?? 0,
            flipH: (node.data.flipH as boolean) ?? false,
            flipV: (node.data.flipV as boolean) ?? false,
          });
          resolved[nodeId]['image'] = result;
        } else if (node.type === 'blend') {
          const imgA = getInput(nodeId, 'imageA') as string;
          const imgB = getInput(nodeId, 'imageB') as string;
          if (!imgA || !imgB) throw new Error('Need two image inputs');

          const result = await applyBlend(imgA, imgB, {
            mode: (node.data.mode as GlobalCompositeOperation) ?? 'source-over',
            opacity: (node.data.opacity as number) ?? 0.5,
          });
          resolved[nodeId]['image'] = result;
        } else if (node.type === 'output') {
          resolved[nodeId]['image'] = getInput(nodeId, 'image');
        }

        get().setNodeStatus(nodeId, 'done', resolved[nodeId]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        get().setNodeStatus(nodeId, 'error', undefined, msg);
        // Continue to other nodes instead of aborting
      }
    }

    set({ isRunning: false });
  },

  clearWorkflow: () => {
    set({ nodes: [], connections: [], selectedIds: [], isRunning: false, pendingConnection: null });
  },

  saveWorkflow: () => {
    const { nodes, connections } = get();
    return JSON.stringify({ nodes, connections }, null, 2);
  },

  loadWorkflow: (json) => {
    try {
      const data = JSON.parse(json);
      set({
        nodes: data.nodes ?? [],
        connections: data.connections ?? [],
        selectedIds: [],
        isRunning: false,
        pendingConnection: null,
      });
    } catch {
      // Invalid JSON — ignore
    }
  },
}));

// ─── Client-side image processing helpers ──────────────────────────────────

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function applyTransform(
  src: string,
  opts: { scaleX: number; scaleY: number; rotation: number; flipH: boolean; flipV: boolean }
): Promise<string> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((opts.rotation * Math.PI) / 180);
  ctx.scale(opts.flipH ? -opts.scaleX : opts.scaleX, opts.flipV ? -opts.scaleY : opts.scaleY);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

async function applyBlend(
  srcA: string,
  srcB: string,
  opts: { mode: GlobalCompositeOperation; opacity: number }
): Promise<string> {
  const [imgA, imgB] = await Promise.all([loadImage(srcA), loadImage(srcB)]);
  const w = Math.max(imgA.width, imgB.width);
  const h = Math.max(imgA.height, imgB.height);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(imgA, 0, 0, w, h);
  ctx.globalAlpha = opts.opacity;
  ctx.globalCompositeOperation = opts.mode;
  ctx.drawImage(imgB, 0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  return canvas.toDataURL('image/png');
}
