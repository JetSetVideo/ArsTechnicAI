import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, ChevronDown, Play, Square, Loader2, ZoomIn, ZoomOut, Maximize,
  Trash2, Wand2, ChevronRight, Scan,
} from 'lucide-react';
import { usePipelineStore, nodePosition, LANE_WIDTH, LANE_GAP, LANE_HEADER, NODE_H, NODE_GAP, laneX } from '@/stores/pipelineStore';
import { PIPELINE_NODE_DEFS, STAGES, STAGE_ORDER, nodesForStage } from '@/lib/pipeline/catalog';
import { ingestImage, payloadStats, formatBytes } from '@/lib/pipeline/ingest';
import type { PipelineStageId } from '@/types/pipeline';
import { useSettingsStore } from '@/stores';
import { useUserStore } from '@/stores/userStore';
import { PipelineNodeCard, nodeIcon } from './PipelineNodeCard';
import { NodeInspector } from './NodeInspector';
import { LayerEditorModal } from './LayerEditorModal';
import { SceneStrip } from './SceneStrip';
import { WorkflowMenu } from './WorkflowMenu';
import { inputPortPos, outputPortPos, edgePath, PORT_COLORS } from './geometry';
import styles from './WorkshopFlow.module.css';

const PIPELINE_AUTOSAVE_MS = 15000;

export const WorkshopFlow: React.FC = () => {
  const {
    nodes, edges, viewport, setViewport, selectedId, select, pendingEdge,
    cancelEdge, removeEdge, addNode, runAll, stopRun, isRunning, clearAll,
    seedStarterFlow, groups, toggleGroupCollapsed, moveNodeToSlot, addVariant,
  } = usePipelineStore();
  const { settings } = useSettingsStore();
  const { currentProject } = useUserStore();

  // Workshop state is scoped per-project (stores/pipelineStore.ts) — load the
  // right project's nodes/scenes on mount/switch, and autosave on an interval
  // plus on unmount/project-switch so nothing is lost when leaving the Workshop.
  useEffect(() => {
    void usePipelineStore.getState().loadForProject(currentProject.id);
  }, [currentProject.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      usePipelineStore.getState().saveForProject(currentProject.id, currentProject.name);
    }, PIPELINE_AUTOSAVE_MS);
    return () => {
      clearInterval(interval);
      usePipelineStore.getState().saveForProject(currentProject.id, currentProject.name);
    };
  }, [currentProject.id, currentProject.name]);

  const apiKey =
    settings.aiProvider.apiKeys?.GOOGLE_IMAGEN ||
    settings.aiProvider.apiKey ||
    '';

  const canvasRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;
  const laneGroups = groups();

  // Debug handle for automated driving/tests
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__arsPipeline = usePipelineStore;
  }, []);

  // Close add-menu on outside click; Escape cancels pending edge
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setShowAddMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { cancelEdge(); setShowAddMenu(false); }
    };
    document.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [cancelEdge]);

  const toScene = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - viewport.x) / viewport.zoom,
      y: (clientY - rect.top - viewport.y) / viewport.zoom,
    };
  }, [viewport]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const zoom = Math.min(2.5, Math.max(0.2, viewport.zoom * factor));
      const zf = zoom / viewport.zoom;
      setViewport({ zoom, x: mx - zf * (mx - viewport.x), y: my - zf * (my - viewport.y) });
    } else {
      setViewport({ ...viewport, x: viewport.x - e.deltaX, y: viewport.y - e.deltaY });
    }
  }, [viewport, setViewport]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      select(null);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [select]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isPanning) {
      setViewport({ ...viewport, x: viewport.x + e.movementX, y: viewport.y + e.movementY });
    }
    if (pendingEdge) setMouse(toScene(e.clientX, e.clientY));
  }, [isPanning, viewport, setViewport, pendingEdge, toScene]);

  const handlePointerUp = useCallback(() => setIsPanning(false), []);

  // Explorer / OS drag-and-drop → curated image node in the lane under cursor
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const pos = toScene(e.clientX, e.clientY);
    const stageIdx = Math.max(0, Math.min(STAGE_ORDER.length - 1, Math.round(pos.x / (LANE_WIDTH + LANE_GAP))));
    const stage = STAGE_ORDER[stageIdx];

    const sources: { src: string; name: string; kind: 'explorer' | 'file' }[] = [];
    const json = e.dataTransfer.getData('application/json');
    if (json) {
      try {
        const asset = JSON.parse(json) as { name?: string; dataUrl?: string; thumbnail?: string; path?: string; type?: string };
        const src = asset.dataUrl || asset.thumbnail || (asset.path?.startsWith('/') ? asset.path : '');
        if (src) sources.push({ src, name: asset.name ?? 'Explorer asset', kind: 'explorer' });
      } catch { /* not an asset payload */ }
    }
    for (const file of Array.from(e.dataTransfer.files ?? [])) {
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      sources.push({ src: dataUrl, name: file.name, kind: 'file' });
    }

    for (const source of sources) {
      const node = addNode('image-import');
      if (!node) continue;
      usePipelineStore.getState().renameNode(node.id, source.name.replace(/\.[a-z0-9]+$/i, ''));
      moveNodeToSlot(node.id, stage, 999);
      try {
        const result = await ingestImage(source.src, { name: source.name, sourceKind: source.kind });
        addVariant(node.id, {
          label: source.name,
          image: result.dataUrl,
          meta: {
            ingest: {
              bytes: result.bytes, width: result.width, height: result.height,
              downscaled: result.downscaled, metadataStripped: result.metadataStripped,
              source: result.sourceKind, warnings: result.warnings,
            },
          },
        });
        usePipelineStore.getState().setParam(node.id, 'file', result.dataUrl);
      } catch {
        usePipelineStore.getState().removeNode(node.id);
      }
    }
  }, [toScene, addNode, moveNodeToSlot, addVariant]);

  // Payload telemetry: how heavy the workshop media currently is
  const stats = useMemo(() => payloadStats(nodes), [nodes]);

  // Fit the whole pipeline into the viewport (space optimization)
  const fitView = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || nodes.length === 0) return;
    const populated = STAGE_ORDER.filter((st) => nodes.some((n) => n.stage === st));
    if (populated.length === 0) return;
    const minX = Math.min(...populated.map((st) => laneX(st)));
    const maxX = Math.max(...populated.map((st) => laneX(st) + LANE_WIDTH));
    const maxSlots = Math.max(
      1,
      ...populated.map((st) => nodes.filter((n) => n.stage === st).length)
    );
    const height = LANE_HEADER + maxSlots * (NODE_H + NODE_GAP) + 40;
    const pad = 48;
    const zoom = Math.min(
      1.4,
      Math.max(0.15, Math.min((rect.width - pad * 2) / (maxX - minX), (rect.height - pad * 2) / height))
    );
    setViewport({
      zoom,
      x: pad - minX * zoom + (rect.width - pad * 2 - (maxX - minX) * zoom) / 2,
      y: pad,
    });
  }, [nodes, setViewport]);

  // Lane geometry: height driven by populated slots so groups grow/shrink live
  const laneHeights = useMemo(() => {
    const heights: Partial<Record<PipelineStageId, number>> = {};
    for (const g of laneGroups) {
      heights[g.stage] = g.collapsed
        ? 62
        : LANE_HEADER + g.nodeIds.length * (NODE_H + NODE_GAP) + 20;
    }
    return heights;
  }, [laneGroups]);

  const pendingSource = pendingEdge
    ? nodes.find((n) => n.id === pendingEdge.from) ?? null
    : null;
  const pendingStart = pendingSource && pendingEdge
    ? outputPortPos(pendingSource, pendingEdge.fromPort)
    : null;

  const collapsedNodeIds = useMemo(() => {
    const hidden = new Set<string>();
    for (const g of laneGroups) if (g.collapsed) g.nodeIds.forEach((id) => hidden.add(id));
    return hidden;
  }, [laneGroups]);

  return (
    <div className={styles.wrap}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div ref={addMenuRef} className={styles.addMenuWrap}>
          <button className={styles.tbtn} onClick={() => setShowAddMenu((v) => !v)}>
            <Plus size={15} /> Add node <ChevronDown size={11} />
          </button>
          {showAddMenu && (
            <div className={styles.addMenu}>
              {STAGE_ORDER.map((stageId) => {
                const stage = STAGES[stageId];
                const stageColor = settings.appearance?.stageLaneColors?.[stageId] || stage.color;
                return (
                  <div
                    key={stageId}
                    className={styles.addMenuStage}
                    style={{ ['--stage-color' as string]: stageColor }}
                  >
                    <div className={styles.addMenuStageTitle}>
                      <span className={styles.addMenuStageDot} />
                      {stage.title}
                    </div>
                    {nodesForStage(stageId).map((def) => (
                      <button
                        key={def.type}
                        className={styles.addMenuItem}
                        onClick={() => { addNode(def.type); setShowAddMenu(false); }}
                      >
                        <span>{def.title}</span>
                        <span className={styles.addMenuItemSub}>{def.subtitle}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button
          className={`${styles.tbtn} ${styles.runBtn}`}
          disabled={nodes.length === 0 || isRunning}
          onClick={() => void runAll(apiKey)}
          title="Run the whole pipeline left → right"
        >
          {isRunning ? <Loader2 size={14} className={styles.spin} /> : <Play size={14} />}
          {isRunning ? 'Running…' : 'Run pipeline'}
        </button>
        {isRunning && (
          <button className={styles.tbtn} onClick={stopRun}>
            <Square size={13} /> Stop
          </button>
        )}

        <div className={styles.divider} />

        <button className={styles.tbtn} onClick={seedStarterFlow} disabled={nodes.length > 0} title="Create the full moodboard → delivery template">
          <Wand2 size={14} /> Starter pipeline
        </button>

        <WorkflowMenu scope="project" projectId={currentProject.id} projectName={currentProject.name} />

        <div className={styles.divider} />

        <button className={styles.tbtn} onClick={() => setViewport({ ...viewport, zoom: Math.min(2.5, viewport.zoom * 1.2) })}>
          <ZoomIn size={14} />
        </button>
        <span className={styles.zoomLabel}>{Math.round(viewport.zoom * 100)}%</span>
        <button className={styles.tbtn} onClick={() => setViewport({ ...viewport, zoom: Math.max(0.2, viewport.zoom / 1.2) })}>
          <ZoomOut size={14} />
        </button>
        <button className={styles.tbtn} onClick={fitView} title="Fit whole pipeline in view">
          <Scan size={14} />
        </button>
        <button className={styles.tbtn} onClick={() => setViewport({ x: 60, y: 40, zoom: 0.85 })} title="Reset view">
          <Maximize size={14} />
        </button>

        <div className={styles.spacer} />

        <span className={styles.counts}>
          {nodes.length} nodes · {edges.length} links{apiKey ? '' : ' · ⚠ no Google API key set'}
        </span>
        {stats.imageCount > 0 && (
          <span
            className={styles.counts}
            style={{
              color: stats.level === 'critical' ? '#f87171' : stats.level === 'warn' ? '#fbbf24' : undefined,
              cursor: 'help',
            }}
            title={`Media payload: ${stats.imageCount} pictures, ${formatBytes(stats.totalBytes)} (all curated on ingest: EXIF/GPS stripped, ≤2048px, stored locally only).${stats.heaviestNode ? ` Heaviest node: ${stats.heaviestNode.title} (${formatBytes(stats.heaviestNode.bytes)}).` : ''}${stats.level !== 'ok' ? ' Approaching browser storage limits — re-encode or delete old versions.' : ''}`}
          >
            · {formatBytes(stats.totalBytes)} media{stats.level !== 'ok' ? ' ⚠' : ''}
          </span>
        )}
        <button
          className={styles.tbtn}
          style={{ color: '#f87171' }}
          onClick={() => {
            if (window.confirm(`Delete all ${nodes.length} nodes, their versions and layers? This cannot be undone.`)) clearAll();
          }}
          title="Clear the workshop"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* ── Canvas ── */}
      <div
        ref={canvasRef}
        className={`${styles.canvas} ${isPanning ? styles.panning : ''} ${pendingEdge ? styles.connecting : ''}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDrop={(e) => void handleDrop(e)}
      >
        <div
          className={styles.grid}
          style={{ backgroundPosition: `${viewport.x}px ${viewport.y}px`, backgroundSize: `${28 * viewport.zoom}px ${28 * viewport.zoom}px` }}
        />

        <div
          className={styles.scene}
          style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}
        >
          {/* Stage lanes — auto-formed groups */}
          {laneGroups.map((group) => {
            const stage = STAGES[group.stage];
            const stageColor = settings.appearance?.stageLaneColors?.[group.stage] || stage.color;
            return (
              <div
                key={group.id}
                className={`${styles.lane} ${group.collapsed ? styles.laneCollapsed : ''}`}
                style={{
                  left: laneX(group.stage),
                  top: 0,
                  width: LANE_WIDTH,
                  height: laneHeights[group.stage],
                  ['--stage-color' as string]: stageColor,
                }}
              >
                <div
                  className={styles.laneHeader}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => toggleGroupCollapsed(group.stage)}
                >
                  <span className={styles.laneIcon}>{nodeIcon(stage.icon, 16)}</span>
                  <div>
                    <div className={styles.laneTitle}>{stage.title}</div>
                    <div className={styles.laneTagline}>{stage.tagline}</div>
                  </div>
                  <span className={styles.laneCount}>{group.nodeIds.length}</span>
                  <ChevronRight size={14} className={styles.laneChevron} style={{ transform: group.collapsed ? undefined : 'rotate(90deg)' }} />
                </div>
              </div>
            );
          })}

          {/* Edges */}
          <svg className={styles.edgeSvg} width={1} height={1}>
            {edges.map((edge) => {
              const from = nodes.find((n) => n.id === edge.from);
              const to = nodes.find((n) => n.id === edge.to);
              if (!from || !to) return null;
              if (collapsedNodeIds.has(from.id) || collapsedNodeIds.has(to.id)) return null;
              const p1 = outputPortPos(from, edge.fromPort);
              const p2 = inputPortPos(to, edge.toPort);
              if (!p1 || !p2) return null;
              const d = edgePath(p1.x, p1.y, p2.x, p2.y);
              const color = PORT_COLORS[edge.type] ?? '#8a8aa2';
              return (
                <g key={edge.id}>
                  <path className={styles.edgeGlow} d={d} stroke={color} />
                  <path
                    className={styles.edgePath}
                    d={d}
                    stroke={color}
                    onClick={(e) => { e.stopPropagation(); removeEdge(edge.id); }}
                  >
                    <title>Click to remove link</title>
                  </path>
                </g>
              );
            })}
            {pendingStart && (
              <path
                className={styles.pendingPath}
                d={edgePath(pendingStart.x, pendingStart.y, mouse.x, mouse.y)}
                stroke={PORT_COLORS[pendingEdge?.portType ?? 'any'] ?? '#cbd5e1'}
              />
            )}
          </svg>

          {/* Nodes */}
          {nodes
            .filter((n) => !collapsedNodeIds.has(n.id))
            .map((node) => (
              <PipelineNodeCard key={node.id} node={node} zoom={viewport.zoom} apiKey={apiKey} />
            ))}
        </div>

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className={styles.empty}>
            <h3>Workshop — Creation Pipeline</h3>
            <p>
              Build your film left to right: moodboard → script → world → storyboard →
              visuals → motion → audio → montage → delivery. Every node can generate,
              import, or be tuned by hand — and stacks alternatives vertically.
            </p>
            <button
              className={styles.emptyCta}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={seedStarterFlow}
            >
              ✨ Create the full starter pipeline
            </button>
          </div>
        )}

        {/* Inspector */}
        {selectedNode && <NodeInspector node={selectedNode} apiKey={apiKey} />}

        {/* Photoshop-style layer editor */}
        <LayerEditorModal />

        {/* Film order — ordered scenes of the final video */}
        <SceneStrip />
      </div>
    </div>
  );
};
