import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Sparkles,
  Cpu,
} from 'lucide-react';
import { useNodeStore, NODE_DEFS, WorkflowNode, NodeConnection, PortType } from '@/stores/nodeStore';
import { useSettingsStore } from '@/stores';
import { RECOMMENDED_GENERATION_MODELS } from '@/stores/settingsStore';
import styles from './NodeGraph.module.css';

// ─── Port colors ────────────────────────────────────────────────────────────
export const PORT_COLORS: Record<PortType, string> = {
  image: '#a855f7',
  text: '#6366f1',
  number: '#f59e0b',
};

// ─── Banana Icon ────────────────────────────────────────────────────────────
export const BananaIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 13c3.5-2 8-2 10 2a5.5 5.5 0 0 1 4 5" />
    <path d="M5.1 15c5.5-2.8 11-2.8 15 2" />
    <path d="M5 15a7 7 0 0 0 14 0" />
    <path d="M5 15c5.5-2.8 11-2.8 15 2" />
  </svg>
);

// ─── Port component ─────────────────────────────────────────────────────────
interface PortDotProps {
  nodeId: string;
  portId: string;
  portType: PortType;
  direction: 'input' | 'output';
  connected: boolean;
}

export const PortDot: React.FC<PortDotProps> = ({ nodeId, portId, portType, direction, connected }) => {
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

// ─── Node body (type-specific controls) ─────────────────────────────────────
interface NodeBodyProps {
  node: WorkflowNode;
  updateNodeData: (id: string, key: string, value: unknown) => void;
}

export const NodeBody: React.FC<NodeBodyProps> = ({ node, updateNodeData }) => {
  const upd = (key: string, value: unknown) => updateNodeData(node.id, key, value);
  const { settings } = useSettingsStore();
  const { executeWorkflow, isRunning } = useNodeStore();
  
  // Local state for UI toggles
  const [showNegative, setShowNegative] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    if (showModelDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModelDropdown]);

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
    const currentModel = (node.data.model as string) || settings.aiProvider.model || 'imagen-3.0-generate-002';
    const hasApiKey = !!((node.data.apiKey as string) || settings.aiProvider.apiKey);

    const handleGenerate = async () => {
      const apiKey = (node.data.apiKey as string) || settings.aiProvider.apiKey;
      await executeWorkflow(apiKey);
    };

    return (
      <div className={styles.nodeFields}>
        {/* Prompt Input */}
        <textarea
          className={styles.nodeTextarea}
          value={(node.data.text as string) ?? ''}
          onChange={(e) => upd('text', e.target.value)}
          placeholder="Describe image..."
          rows={3}
          style={{ marginBottom: '0.5rem' }}
        />

        {/* Negative Prompt Toggle */}
        <div 
          className={styles.nodeFieldLabel} 
          onClick={() => setShowNegative(!showNegative)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '0.25rem' }}
        >
          {showNegative ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Negative Prompt
        </div>
        
        {showNegative && (
          <textarea
            className={styles.nodeTextarea}
            value={(node.data.negative as string) ?? ''}
            onChange={(e) => upd('negative', e.target.value)}
            placeholder="What to avoid..."
            rows={2}
            style={{ marginBottom: '0.5rem' }}
          />
        )}

        {/* Controls Row */}
        <div className={styles.nodeFieldRow} style={{ marginTop: '0.5rem' }}>
          {/* Model Selector */}
          <div style={{ position: 'relative', flex: 1 }} ref={dropdownRef}>
            <button 
              className={styles.nodeBtn}
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              title={currentModel}
              style={{ width: '100%', justifyContent: 'space-between', padding: '0 8px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                {currentModel.includes('banana') ? <BananaIcon width={14} height={14} /> : <Cpu size={14} />}
                <span style={{ fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentModel.split('-').slice(0, 2).join('-')}
                </span>
              </div>
              <ChevronDown size={10} />
            </button>
            
            {showModelDropdown && (
              <div className={styles.nodeDropdown}>
                {RECOMMENDED_GENERATION_MODELS.map((model) => (
                  <button
                    key={model}
                    className={`${styles.nodeDropdownItem} ${currentModel === model ? styles.active : ''}`}
                    onClick={() => {
                      upd('model', model);
                      setShowModelDropdown(false);
                    }}
                  >
                    {model}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            className={`${styles.nodeBtn} ${styles.primaryBtn}`}
            onClick={handleGenerate}
            disabled={isRunning || !hasApiKey}
            title="Generate"
            style={{ flex: 0, minWidth: '32px', padding: 0, justifyContent: 'center' }}
          >
            {isRunning ? <Loader2 size={14} className={styles.spin} /> : <Sparkles size={14} />}
          </button>
        </div>

        {/* API Key (collapsible or small) */}
        <div className={styles.nodeFieldRow} style={{ marginTop: '0.5rem' }}>
           <input
            type="password"
            className={`${styles.nodeInput} ${styles.nodeInputFull}`}
            placeholder="API Key (optional)"
            value={(node.data.apiKey as string) ?? ''}
            onChange={(e) => upd('apiKey', e.target.value)}
            style={{ fontSize: '10px', height: '24px' }}
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

// ─── Node card ──────────────────────────────────────────────────────────────
interface NodeCardProps {
  node: WorkflowNode;
  zoom: number;
  isSelected: boolean;
  connections: NodeConnection[];
}

export const NodeCard: React.FC<NodeCardProps> = ({ node, zoom, isSelected, connections }) => {
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

export const ConnLine: React.FC<ConnLineProps> = ({ conn, nodes, zoom }) => {
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
