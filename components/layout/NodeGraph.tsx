import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  Play,
  Trash2,
  Plus,
  Save,
  Upload,
  X,
  Loader2,
  ChevronDown,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Maximize,
} from 'lucide-react';
import { useNodeStore, NODE_DEFS, WorkflowNode, NodeConnection, NodeType, PortType } from '@/stores/nodeStore';
import { useCanvasStore, useSettingsStore } from '@/stores';
import styles from './NodeGraph.module.css';

// ─── Port colors ────────────────────────────────────────────────────────────
const PORT_COLORS: Record<PortType, string> = {
  image: '#a855f7',
  text: '#6366f1',
  number: '#f59e0b',
};

// ─── Port component ─────────────────────────────────────────────────────────
interface PortDotProps {
  nodeId: string;
  portId: string;
  portType: PortType;
  direction: 'input' | 'output';
  connected: boolean;
}

const PortDot: React.FC<PortDotProps> = ({ nodeId, portId, portType, direction, connected }) => {
  const { pendingConnection, startConnection, completeConnection, cancelConnection } = useNodeStore();
  const color = PORT_COLORS[portType];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (direction === 'output') {
      if (pendingConnection?.nodeId === nodeId && pendingConnection?.port === portId) {
        cancelConnection();
      } else {
        startConnection(nodeId, portId, portType);
      }
    } else {
      if (pendingConnection) {
        completeConnection(nodeId, portId);
      }
    }
  };

  const isActive =
    pendingConnection?.nodeId === nodeId && pendingConnection?.port === portId;

  return (
    <div
      className={`${styles.port} ${styles[direction]} ${isActive ? styles.portActive : ''} ${connected ? styles.portConnected : ''}`}
      style={{ '--port-color': color } as React.CSSProperties}
      onClick={handleClick}
      title={`${direction}: ${portId}`}
    />
  );
};

// ─── Node card ──────────────────────────────────────────────────────────────
interface NodeCardProps {
  node: WorkflowNode;
  zoom: number;
  isSelected: boolean;
  connections: NodeConnection[];
}

const NodeCard: React.FC<NodeCardProps> = ({ node, zoom, isSelected, connections }) => {
  const { removeNode, updateNodeData, selectNode, moveNode } = useNodeStore();
  const def = NODE_DEFS[node.type];

  const dragOrigin = useRef<{ mouseX: number; mouseY: number; nodeX: number; nodeY: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    e.stopPropagation();
    selectNode(node.id, e.shiftKey);
    dragOrigin.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
    };

    const handleMove = (me: MouseEvent) => {
      if (!dragOrigin.current) return;
      const dx = (me.clientX - dragOrigin.current.mouseX) / zoom;
      const dy = (me.clientY - dragOrigin.current.mouseY) / zoom;
      moveNode(node.id, dragOrigin.current.nodeX + dx, dragOrigin.current.nodeY + dy);
    };

    const handleUp = () => {
      dragOrigin.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const isConnectedPort = (portId: string, dir: 'input' | 'output') =>
    connections.some(
      (c) =>
        (dir === 'output' && c.fromNodeId === node.id && c.fromPort === portId) ||
        (dir === 'input' && c.toNodeId === node.id && c.toPort === portId)
    );

  const statusColor = {
    idle: 'transparent',
    running: '#f59e0b',
    done: '#22c55e',
    error: '#ef4444',
  }[node.status];

  return (
    <div
      className={`${styles.nodeCard} ${isSelected ? styles.nodeSelected : ''} ${styles[`node_${node.status}`]}`}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        '--node-color': def.color,
        '--status-color': statusColor,
      } as React.CSSProperties}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className={styles.nodeHeader}>
        <div className={styles.nodeStatusDot} />
        <span className={styles.nodeTitle}>{node.title}</span>
        <button
          className={styles.nodeDelete}
          data-no-drag
          onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
          title="Remove node"
        >
          <X size={12} />
        </button>
      </div>

      {/* Ports row */}
      <div className={styles.portsRow}>
        {/* Input ports (left) */}
        <div className={styles.inputPorts}>
          {def.inputs.map((p) => (
            <div key={p.id} className={styles.portRow}>
              <PortDot
                nodeId={node.id}
                portId={p.id}
                portType={p.type}
                direction="input"
                connected={isConnectedPort(p.id, 'input')}
              />
              <span className={styles.portLabel}>{p.label}</span>
            </div>
          ))}
        </div>

        {/* Output ports (right) */}
        <div className={styles.outputPorts}>
          {def.outputs.map((p) => (
            <div key={p.id} className={`${styles.portRow} ${styles.portRowRight}`}>
              <span className={styles.portLabel}>{p.label}</span>
              <PortDot
                nodeId={node.id}
                portId={p.id}
                portType={p.type}
                direction="output"
                connected={isConnectedPort(p.id, 'output')}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Node-specific body */}
      <div className={styles.nodeBody} data-no-drag>
        <NodeBody node={node} updateNodeData={updateNodeData} />
      </div>

      {/* Result preview for output/generator nodes */}
      {node.status === 'done' && node.result && (
        <div className={styles.nodeResult}>
          {typeof (node.result as any)?.image === 'string' && (
            <img src={(node.result as any).image} alt="result" className={styles.resultImg} />
          )}
          {typeof (node.result as any)?.image !== 'string' &&
            node.type === 'output' &&
            typeof (node.result as any)?.image === 'string' && (
              <img src={(node.result as any).image} alt="output" className={styles.resultImg} />
            )}
        </div>
      )}

      {node.status === 'error' && node.error && (
        <div className={styles.nodeError}>{node.error}</div>
      )}
    </div>
  );
};

// ─── Node body (type-specific controls) ─────────────────────────────────────
interface NodeBodyProps {
  node: WorkflowNode;
  updateNodeData: (id: string, key: string, value: unknown) => void;
}

const NodeBody: React.FC<NodeBodyProps> = ({ node, updateNodeData }) => {
  const upd = (key: string, value: unknown) => updateNodeData(node.id, key, value);

  if (node.type === 'prompt' || node.type === 'negative') {
    return (
      <textarea
        className={styles.nodeTextarea}
        value={(node.data.text as string) ?? ''}
        onChange={(e) => upd('text', e.target.value)}
        placeholder={node.type === 'prompt' ? 'Enter prompt…' : 'Enter negative prompt…'}
        rows={3}
      />
    );
  }

  if (node.type === 'generator') {
    return (
      <div className={styles.nodeFields}>
        <div className={styles.nodeFieldRow}>
          <label>W</label>
          <input
            type="number"
            className={styles.nodeInput}
            value={(node.data.width as number) ?? 1024}
            onChange={(e) => upd('width', parseInt(e.target.value) || 1024)}
            step={64} min={256} max={2048}
          />
          <label>H</label>
          <input
            type="number"
            className={styles.nodeInput}
            value={(node.data.height as number) ?? 1024}
            onChange={(e) => upd('height', parseInt(e.target.value) || 1024)}
            step={64} min={256} max={2048}
          />
        </div>
        <div className={styles.nodeFieldRow}>
          <label>API Key</label>
          <input
            type="password"
            className={`${styles.nodeInput} ${styles.nodeInputFull}`}
            placeholder="Override API key…"
            value={(node.data.apiKey as string) ?? ''}
            onChange={(e) => upd('apiKey', e.target.value)}
          />
        </div>
      </div>
    );
  }

  if (node.type === 'image-in') {
    return (
      <div className={styles.nodeFields}>
        <label
          className={styles.imageDropZone}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const data = e.dataTransfer.getData('application/json');
            if (data) {
              try {
                const asset = JSON.parse(data);
                upd('src', asset.thumbnail || asset.dataUrl || '');
                upd('name', asset.name || 'image');
              } catch {}
            }
          }}
        >
          {node.data.src ? (
            <img src={node.data.src as string} alt="" className={styles.imagePreview} />
          ) : (
            <span className={styles.imageDropLabel}>
              <ImageIcon size={16} />
              Drop image here
            </span>
          )}
        </label>
      </div>
    );
  }

  if (node.type === 'transform') {
    return (
      <div className={styles.nodeFields}>
        <div className={styles.nodeFieldRow}>
          <label>Scale X</label>
          <input
            type="number" step={0.1} min={0.1} max={4}
            className={styles.nodeInput}
            value={(node.data.scaleX as number) ?? 1}
            onChange={(e) => upd('scaleX', parseFloat(e.target.value) || 1)}
          />
          <label>Y</label>
          <input
            type="number" step={0.1} min={0.1} max={4}
            className={styles.nodeInput}
            value={(node.data.scaleY as number) ?? 1}
            onChange={(e) => upd('scaleY', parseFloat(e.target.value) || 1)}
          />
        </div>
        <div className={styles.nodeFieldRow}>
          <label>Rotation</label>
          <input
            type="number" step={15} min={-360} max={360}
            className={`${styles.nodeInput} ${styles.nodeInputFull}`}
            value={(node.data.rotation as number) ?? 0}
            onChange={(e) => upd('rotation', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className={styles.nodeFieldRow}>
          <label>Flip H</label>
          <input
            type="checkbox"
            checked={!!(node.data.flipH)}
            onChange={(e) => upd('flipH', e.target.checked)}
          />
          <label>Flip V</label>
          <input
            type="checkbox"
            checked={!!(node.data.flipV)}
            onChange={(e) => upd('flipV', e.target.checked)}
          />
        </div>
      </div>
    );
  }

  if (node.type === 'blend') {
    const modes = ['source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'hard-light', 'soft-light', 'difference'];
    return (
      <div className={styles.nodeFields}>
        <div className={styles.nodeFieldRow}>
          <label>Mode</label>
          <select
            className={`${styles.nodeInput} ${styles.nodeInputFull}`}
            value={(node.data.mode as string) ?? 'source-over'}
            onChange={(e) => upd('mode', e.target.value)}
          >
            {modes.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className={styles.nodeFieldRow}>
          <label>Opacity</label>
          <input
            type="range" min={0} max={1} step={0.05}
            className={`${styles.nodeInput} ${styles.nodeInputFull}`}
            value={(node.data.opacity as number) ?? 0.5}
            onChange={(e) => upd('opacity', parseFloat(e.target.value))}
          />
          <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
            {Math.round(((node.data.opacity as number) ?? 0.5) * 100)}%
          </span>
        </div>
      </div>
    );
  }

  if (node.type === 'output') {
    return (
      <div className={styles.nodeFields}>
        <input
          className={`${styles.nodeInput} ${styles.nodeInputFull}`}
          placeholder="Label"
          value={(node.data.label as string) ?? 'Result'}
          onChange={(e) => upd('label', e.target.value)}
        />
      </div>
    );
  }

  return null;
};

// ─── Connection line (SVG bezier) ─────────────────────────────────────────────
interface ConnLineProps {
  conn: NodeConnection;
  nodes: WorkflowNode[];
  zoom: number;
}

function getPortPos(
  node: WorkflowNode,
  portId: string,
  direction: 'input' | 'output',
  zoom: number
): { x: number; y: number } {
  const def = NODE_DEFS[node.type];
  const ports = direction === 'output' ? def.outputs : def.inputs;
  const idx = ports.findIndex((p) => p.id === portId);

  // Approximate vertical position: header ~32px + ports offset 12px each + 12px base
  const headerH = 32;
  const portH = 28;
  const y = node.y + headerH + 12 + idx * portH + 6;
  const x = direction === 'output' ? node.x + node.width : node.x;

  return { x, y };
}

const ConnLine: React.FC<ConnLineProps> = ({ conn, nodes, zoom }) => {
  const fromNode = nodes.find((n) => n.id === conn.fromNodeId);
  const toNode = nodes.find((n) => n.id === conn.toNodeId);
  if (!fromNode || !toNode) return null;

  const from = getPortPos(fromNode, conn.fromPort, 'output', zoom);
  const to = getPortPos(toNode, conn.toPort, 'input', zoom);

  const cpOffset = Math.max(80, Math.abs(to.x - from.x) * 0.5);
  const d = `M ${from.x} ${from.y} C ${from.x + cpOffset} ${from.y}, ${to.x - cpOffset} ${to.y}, ${to.x} ${to.y}`;

  const { removeConnection } = useNodeStore();

  return (
    <g>
      <path d={d} stroke="rgba(255,255,255,0.08)" strokeWidth={4} fill="none" />
      <path
        d={d}
        stroke="var(--accent-primary)"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        style={{ filter: 'drop-shadow(0 0 4px var(--accent-primary))' }}
      />
      {/* Invisible thick path for click detection */}
      <path
        d={d}
        stroke="transparent"
        strokeWidth={12}
        fill="none"
        style={{ cursor: 'pointer' }}
        onClick={() => removeConnection(conn.id)}
        title="Click to remove connection"
      />
    </g>
  );
};

// ─── Add Node menu ────────────────────────────────────────────────────────────
const NODE_TYPES: NodeType[] = ['prompt', 'negative', 'generator', 'image-in', 'transform', 'blend', 'output'];

const AddNodeMenu: React.FC<{ onAdd: (type: NodeType) => void; onClose: () => void }> = ({ onAdd, onClose }) => (
  <div className={styles.addNodeMenu}>
    {NODE_TYPES.map((t) => {
      const def = NODE_DEFS[t];
      return (
        <button
          key={t}
          className={styles.addNodeItem}
          onClick={() => { onAdd(t); onClose(); }}
          style={{ '--node-color': def.color } as React.CSSProperties}
        >
          <span className={styles.addNodeDot} />
          {def.title}
        </button>
      );
    })}
  </div>
);

// ─── Main NodeGraph ───────────────────────────────────────────────────────────
export const NodeGraph: React.FC = () => {
  const { nodes, connections, isRunning, addNode, clearWorkflow, saveWorkflow, loadWorkflow, cancelConnection, pendingConnection } = useNodeStore();
  const { settings } = useSettingsStore();
  const { addItem } = useCanvasStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close add menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    if (showAddMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAddMenu]);

  // Cancel pending connection on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelConnection();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cancelConnection]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(3, Math.max(0.2, viewport.zoom * delta));
      const zf = newZoom / viewport.zoom;
      setViewport((v) => ({
        zoom: newZoom,
        x: mouseX - zf * (mouseX - v.x),
        y: mouseY - zf * (mouseY - v.y),
      }));
    } else {
      setViewport((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    }
  }, [viewport]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setViewport((v) => ({ ...v, x: v.x + e.movementX, y: v.y + e.movementY }));
    }
  }, [isPanning]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    if ((e.target as HTMLElement).closest('[data-node]')) return;

    const x = (e.clientX - rect.left - viewport.x) / viewport.zoom;
    const y = (e.clientY - rect.top - viewport.y) / viewport.zoom;
    addNode('generator', x - 140, y - 60);
  }, [viewport, addNode]);

  const handleAddNode = useCallback((type: NodeType) => {
    const cx = (containerRef.current?.clientWidth ?? 600) / 2;
    const cy = (containerRef.current?.clientHeight ?? 400) / 2;
    const x = (cx - viewport.x) / viewport.zoom - 130;
    const y = (cy - viewport.y) / viewport.zoom - 60;
    addNode(type, x, y);
  }, [addNode, viewport]);

  const handleExecute = useCallback(async () => {
    const apiKey = settings.aiProvider.apiKey;
    await useNodeStore.getState().executeWorkflow(apiKey);

    // After execution, add output node results to the canvas
    const { nodes: finalNodes } = useNodeStore.getState();
    finalNodes
      .filter((n) => n.type === 'output' && n.status === 'done')
      .forEach((n) => {
        const imgSrc = (n.result as any)?.image;
        if (typeof imgSrc === 'string') {
          addItem({
            type: 'generated',
            x: 100 + Math.random() * 100,
            y: 100 + Math.random() * 100,
            width: 512,
            height: 512,
            rotation: 0,
            scale: 0.5,
            locked: false,
            visible: true,
            src: imgSrc,
            name: `Workflow output`,
          });
        }
      });
  }, [settings.aiProvider.apiKey, addItem]);

  const handleSave = useCallback(() => {
    const json = saveWorkflow();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workflow.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [saveWorkflow]);

  const handleLoad = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadWorkflow(reader.result as string);
    reader.readAsText(file);
    e.target.value = '';
  }, [loadWorkflow]);

  // SVG dimensions (large enough to cover the graph area at any pan/zoom)
  const svgW = 10000;
  const svgH = 10000;

  return (
    <div className={styles.graphWrapper}>
      {/* Toolbar */}
      <div className={styles.graphToolbar}>
        <div ref={addMenuRef} style={{ position: 'relative' }}>
          <button
            className={styles.toolbarBtn}
            onClick={() => setShowAddMenu((v) => !v)}
            title="Add node"
          >
            <Plus size={16} />
            Add Node
            <ChevronDown size={12} />
          </button>
          {showAddMenu && <AddNodeMenu onAdd={handleAddNode} onClose={() => setShowAddMenu(false)} />}
        </div>

        <button
          className={`${styles.toolbarBtn} ${styles.runBtn}`}
          onClick={handleExecute}
          disabled={isRunning || nodes.length === 0}
          title="Execute workflow"
        >
          {isRunning ? <Loader2 size={16} className={styles.spin} /> : <Play size={16} />}
          {isRunning ? 'Running…' : 'Run'}
        </button>

        <div className={styles.toolbarDivider} />

        <button className={styles.toolbarBtn} onClick={handleSave} title="Save workflow JSON">
          <Save size={16} />
        </button>
        <button className={styles.toolbarBtn} onClick={() => fileInputRef.current?.click()} title="Load workflow JSON">
          <Upload size={16} />
        </button>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleLoad} />

        <div className={styles.toolbarDivider} />

        <button
          className={styles.toolbarBtn}
          onClick={() => setViewport((v) => ({ ...v, zoom: Math.min(3, v.zoom * 1.2) }))}
          title="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <span className={styles.zoomLabel}>{Math.round(viewport.zoom * 100)}%</span>
        <button
          className={styles.toolbarBtn}
          onClick={() => setViewport((v) => ({ ...v, zoom: Math.max(0.2, v.zoom / 1.2) }))}
          title="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          className={styles.toolbarBtn}
          onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
          title="Reset view"
        >
          <Maximize size={16} />
        </button>

        <div className={styles.toolbarSpacer} />

        <button
          className={styles.toolbarBtn}
          onClick={clearWorkflow}
          title="Clear all nodes"
          style={{ color: 'var(--error-solid)' }}
        >
          <Trash2 size={16} />
          Clear
        </button>

        <span className={styles.nodeCount}>
          {nodes.length} node{nodes.length !== 1 ? 's' : ''} · {connections.length} connection{connections.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Graph area */}
      <div
        ref={containerRef}
        className={`${styles.graph} ${pendingConnection ? styles.connecting : ''} ${isPanning ? styles.panning : ''}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onClick={() => useNodeStore.getState().clearSelection()}
      >
        {/* Grid background */}
        <svg className={styles.gridSvg} style={{ transform: `translate(${viewport.x % 40}px, ${viewport.y % 40}px)` }}>
          <defs>
            <pattern id="grid-small" width={40 * viewport.zoom} height={40 * viewport.zoom} patternUnits="userSpaceOnUse">
              <path d={`M ${40 * viewport.zoom} 0 L 0 0 0 ${40 * viewport.zoom}`} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            </pattern>
            <pattern id="grid-large" width={200 * viewport.zoom} height={200 * viewport.zoom} patternUnits="userSpaceOnUse">
              <rect width={200 * viewport.zoom} height={200 * viewport.zoom} fill="url(#grid-small)" />
              <path d={`M ${200 * viewport.zoom} 0 L 0 0 0 ${200 * viewport.zoom}`} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="200%" height="200%" fill="url(#grid-large)" />
        </svg>

        {/* Transformed layer */}
        <div
          className={styles.graphContent}
          style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}
        >
          {/* SVG for connection lines */}
          <svg
            className={styles.connSvg}
            width={svgW}
            height={svgH}
            style={{ left: -svgW / 2, top: -svgH / 2 }}
          >
            <g transform={`translate(${svgW / 2}, ${svgH / 2})`}>
              {connections.map((conn) => (
                <ConnLine key={conn.id} conn={conn} nodes={nodes} zoom={viewport.zoom} />
              ))}
            </g>
          </svg>

          {/* Node cards */}
          {nodes.map((node) => (
            <div key={node.id} data-node style={{ position: 'absolute', left: 0, top: 0 }}>
              <NodeCard
                node={node}
                zoom={viewport.zoom}
                isSelected={useNodeStore.getState().selectedIds.includes(node.id)}
                connections={connections}
              />
            </div>
          ))}
        </div>

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>⬡</div>
            <h3>Node Graph Editor</h3>
            <p>Double-click to add a Generator node, or use the Add Node button above.</p>
            <p className={styles.emptyHint}>Connect nodes by clicking output ports then input ports.</p>
          </div>
        )}
      </div>
    </div>
  );
};
