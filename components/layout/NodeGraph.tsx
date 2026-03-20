import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  Play,
  Trash2,
  Plus,
  Upload,
  Loader2,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Maximize,
} from 'lucide-react';
import { useNodeStore, NODE_DEFS, NodeType } from '@/stores/nodeStore';
import { useCanvasStore, useSettingsStore } from '@/stores';
import styles from './NodeGraph.module.css';
import { NodeCard, ConnLine } from './NodeComponents';

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
  const { nodes, connections, isRunning, addNode, clearWorkflow, loadWorkflow, cancelConnection, pendingConnection } = useNodeStore();
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
