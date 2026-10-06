import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, ChevronDown, Play, Square, Loader2, ZoomIn, ZoomOut, Maximize,
  Trash2, ChevronRight, Scan, Undo2, FolderClock,
} from 'lucide-react';
import { usePipelineStore, nodePosition, LANE_WIDTH, LANE_PAD_X, NODE_H, NODE_GAP, NODE_W, laneX } from '@/stores/pipelineStore';
import { rectsOverlap } from '@/lib/pipeline/lanes';
import {
  CLUSTER_GAP_MIN_X, CLUSTER_HEADER, CLUSTER_PAD_BOTTOM, CLUSTER_PAD_TOP, CLUSTER_PAD_X,
  minClusterSize, packCluster, plateAround, resizeClusterFrame, type ClusterEdgeName,
} from '@/lib/pipeline/clusterLayout';
import { COLLAPSED_HEADER, collapsedClusterSize, collapsedLaneHeight, collapsedStack, laneFrameHeight } from './laneFrames';
import { cyclePointForStage, wiringFor } from './groupCycles';
import { settleNode } from './settleNode';
import { PIPELINE_NODE_DEFS, STAGES, STAGE_ORDER, linkCandidates, nodesForStage, type LinkCandidate } from '@/lib/pipeline/catalog';
import { ingestImage, payloadStats, formatBytes } from '@/lib/pipeline/ingest';
import type { PipelineStageId } from '@/types/pipeline';
import { useSettingsStore, useLogStore } from '@/stores';
import { useUserStore } from '@/stores/userStore';
import { PipelineNodeCard, nodeIcon, type WireDrop } from './PipelineNodeCard';
import { ChoiceWheel } from './ChoiceWheel';
import type { WheelSlice } from '@/lib/pipeline/wheelSlices';
import { NodeInspector } from './NodeInspector';
import { LayerEditorModal } from './LayerEditorModal';
import { SceneStrip } from './SceneStrip';
import { WorkshopOverview } from './WorkshopOverview';
import { WorkflowPicker } from './WorkflowPicker';
import { useBlueprintStore } from '@/stores/blueprintStore';
import { PENDING_BLUEPRINT_KEY, specToBlueprint, workflowIcon, type BlueprintSpec } from '@/lib/pipeline/blueprintBridge';
import { inputPortPos, outputPortPos, edgePath, PORT_COLORS } from './geometry';
import { formatShortcut, matchShortcut } from '@/lib/shortcuts';
import styles from './WorkshopFlow.module.css';

function linkWheelSlices(
  choices: LinkCandidate[],
  colorOf: (stage: PipelineStageId) => string,
): WheelSlice[] {
  const order: PipelineStageId[] = [];
  const groups = new Map<PipelineStageId, LinkCandidate[]>();
  for (const choice of choices) {
    if (!groups.has(choice.stage)) {
      groups.set(choice.stage, []);
      order.push(choice.stage);
    }
    groups.get(choice.stage)!.push(choice);
  }
  return order.map((stageId) => {
    const stage = STAGES[stageId];
    const color = colorOf(stageId);
    const items = groups.get(stageId) ?? [];
    return {
      id: stageId,
      label: items.length === 1 ? items[0].title : stage.title,
      icon: items.length === 1 ? items[0].icon : stage.icon,
      color,
      options: items.map((item) => ({
        id: item.type,
        label: item.title,
        hint: PIPELINE_NODE_DEFS[item.type]?.subtitle,
        icon: item.icon,
        color,
      })),
    };
  });
}

function placeWheel(client: number, origin: number, limit: number, padStart: number, padEnd: number): number {
  const min = padStart;
  const max = Math.max(min, limit - padEnd);
  return Math.min(Math.max(client - origin, min), max);
}

export const WorkshopFlow: React.FC = () => {
  // Only subscribe to the fields this component actually renders from —
  // previously this whole-store-destructured, so e.g. a scene-strip edit or
  // a paramTemplate save (fields never read here) would re-render the whole
  // canvas anyway. `collapsedStages` is included because `groups()` reads it
  // internally and this component calls `groups()` directly in render.
  const nodes = usePipelineStore((s) => s.nodes);
  const isLoadingProject = usePipelineStore((s) => s.isLoadingProject);
  const loadedProjectId = usePipelineStore((s) => s.currentProjectId);
  const scenes = usePipelineStore((s) => s.scenes);
  const edges = usePipelineStore((s) => s.edges);
  const viewport = usePipelineStore((s) => s.viewport);
  const selectedId = usePipelineStore((s) => s.selectedId);
  const pendingEdge = usePipelineStore((s) => s.pendingEdge);
  const isRunning = usePipelineStore((s) => s.isRunning);
  const undoDepth = usePipelineStore((s) => s.undoDepth);
  const undoLabel = usePipelineStore((s) => s.undoLabel);
  usePipelineStore((s) => s.collapsedStages);
  const openStages = usePipelineStore((s) => s.openStages);
  const draggingId = usePipelineStore((s) => s.draggingId);
  const dragInsertIndex = usePipelineStore((s) => s.dragInsertIndex);
  const {
    setViewport, select, cancelEdge, removeEdge, addNode, runAll, stopRun,
    clearAll, groups, toggleGroupCollapsed, addVariant,
    openStage, closeStage,
  } = usePipelineStore.getState();
  const { settings } = useSettingsStore();
  const { currentProject } = useUserStore();

  // Workshop state is scoped per-project (stores/pipelineStore.ts) — load the
  // right project's nodes/scenes on mount/switch. Saving is handled by the
  // store's own dirty-checked, debounced autosave (fires only when something
  // actually changed — see the `usePipelineStore.subscribe` at the bottom of
  // pipelineStore.ts); we only need a final flush on unmount/project-switch
  // so nothing written in the last debounce window is lost.
  useEffect(() => {
    void usePipelineStore.getState().loadForProject(currentProject.id, currentProject.name);
  }, [currentProject.id, currentProject.name]);

  // A lone imported picture is not a moodboard. Release it once the project is open
  // so an older drop (slotted into Concept) does not keep a hidden lane membership.
  useEffect(() => {
    if (isLoadingProject || loadedProjectId !== currentProject.id) return;
    usePipelineStore.getState().releaseSparseMoodboard();
    usePipelineStore.getState().compactLanes();
  }, [isLoadingProject, loadedProjectId, currentProject.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isLoadingProject || loadedProjectId !== currentProject.id) return;
    const applyPending = () => {
      const blueprintId = sessionStorage.getItem(PENDING_BLUEPRINT_KEY);
      if (!blueprintId) return;
      useBlueprintStore.getState().ensureStarters();
      const blueprint = useBlueprintStore.getState().blueprints.find((item) => item.id === blueprintId);
      sessionStorage.removeItem(PENDING_BLUEPRINT_KEY);
      if (blueprint) usePipelineStore.getState().applyBlueprint(blueprint, 'replace');
    };
    if (useBlueprintStore.persist.hasHydrated()) {
      applyPending();
      return;
    }
    return useBlueprintStore.persist.onFinishHydration(applyPending);
  }, [isLoadingProject, loadedProjectId, currentProject.id]);

  useEffect(() => {
    usePipelineStore.getState().clearRetiredModelErrors();
  }, []);

  useEffect(() => {
    const history = {
      steps: () => useLogStore.getState().getEntriesForCurrentProject()
        .filter((entry) => entry.type === 'workshop_edit')
        .map((entry) => ({
          id: entry.id,
          sentence: entry.description,
          at: entry.timestamp,
          returned: entry.data?.undone === true,
        })),
      undo: () => usePipelineStore.getState().undo(),
      depth: () => usePipelineStore.getState().undoDepth,
    };
    (window as unknown as Record<string, unknown>).__arsHistory = history;
    return () => {
      delete (window as unknown as Record<string, unknown>).__arsHistory;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const shortcut = useSettingsStore.getState().settings.shortcuts?.undo ?? 'mod+z';
      if (!matchShortcut(event, shortcut)) return;
      event.preventDefault();
      usePipelineStore.getState().undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    return () => {
      usePipelineStore.getState().saveForProject(currentProject.id, currentProject.name);
    };
  }, [currentProject.id, currentProject.name]);

  const apiKey =
    settings.aiProvider.apiKeys?.GOOGLE_IMAGEN ||
    settings.aiProvider.apiKey ||
    '';

  const canvasRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const spaceRef = useRef(false);
  const marqueeRef = useRef<{ x0: number; y0: number; x1: number; y1: number; clientX: number; clientY: number; additive: boolean } | null>(null);
  const pickedRef = useRef<string[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showWorkflowPicker, setShowWorkflowPicker] = useState(false);
  const fitAfterOpen = useRef(false);
  const clusterSpacingSettled = useRef(false);
  const clusterResize = useRef<{
    id: string;
    edge: ClusterEdgeName;
    x: number;
    y: number;
    frame: { x: number; y: number; w: number; h: number };
    min: { w: number; h: number };
  } | null>(null);
  const [clusterResizing, setClusterResizing] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [viewFitted, setViewFitted] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  pickedRef.current = picked;
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [selectedLane, setSelectedLane] = useState<PipelineStageId | null>(null);
  const [wheel, setWheel] = useState<{ clientX: number; clientY: number; ids: string[] } | null>(null);
  const [linkWheel, setLinkWheel] = useState<(WireDrop & { choices: LinkCandidate[] }) | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.code !== 'Space') return;
      spaceRef.current = true;
      event.preventDefault();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    setSelectedClusterId(null);
    setSelectedLane(null);
  }, [selectedId]);

  const deleteTarget = useMemo(() => {
    if (selectedClusterId) {
      const members = nodes.filter((node) => node.clusterId === selectedClusterId);
      if (members.length === 0) return null;
      return { ids: members.map((node) => node.id), label: members[0].clusterTitle || 'group' };
    }
    if (selectedLane) {
      const members = nodes.filter((node) => node.stage === selectedLane && node.inLane !== false);
      if (members.length === 0) return null;
      return { ids: members.map((node) => node.id), label: STAGES[selectedLane].title };
    }
    if (selectedNode) return { ids: [selectedNode.id], label: selectedNode.title };
    if (picked.length > 0) {
      const members = nodes.filter((node) => picked.includes(node.id));
      if (members.length === 0) return null;
      return {
        ids: members.map((node) => node.id),
        label: members.length === 1 ? members[0].title : `${members.length} nodes`,
      };
    }
    return null;
  }, [nodes, picked, selectedClusterId, selectedLane, selectedNode]);
  const laneGroups = groups();
  const dragOverStage = usePipelineStore((s) => s.dragOverStage);

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
      if (e.key === 'Escape') {
        cancelEdge();
        setShowAddMenu(false);
        setWheel(null);
        setLinkWheel(null);
        setPicked([]);
        setMarquee(null);
        marqueeRef.current = null;
      }
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
    if (usePipelineStore.getState().pendingEdge) return;
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
    const target = e.target as HTMLElement;
    if (target.closest('[data-node], [data-wheel]')) return;
    const capture = () => {
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    };
    if (e.button === 1 || (e.button === 0 && spaceRef.current)) {
      setIsPanning(true);
      capture();
      return;
    }
    if (linkWheel) setLinkWheel(null);
    if (e.button !== 0 || pendingEdge) return;
    const scene = toScene(e.clientX, e.clientY);
    marqueeRef.current = {
      x0: scene.x, y0: scene.y, x1: scene.x, y1: scene.y,
      clientX: e.clientX, clientY: e.clientY, additive: e.shiftKey,
    };
    setSelecting(true);
    setWheel(null);
    setSelectedClusterId(null);
    setSelectedLane(null);
    if (!e.shiftKey) setPicked([]);
    select(null);
    capture();
  }, [pendingEdge, select, toScene, linkWheel]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isPanning) {
      setViewport({ ...viewport, x: viewport.x + e.movementX, y: viewport.y + e.movementY });
    }
    const drag = marqueeRef.current;
    if (drag) {
      const scene = toScene(e.clientX, e.clientY);
      drag.x1 = scene.x;
      drag.y1 = scene.y;
      drag.clientX = e.clientX;
      drag.clientY = e.clientY;
      setMarquee({
        x: Math.min(drag.x0, drag.x1),
        y: Math.min(drag.y0, drag.y1),
        w: Math.abs(drag.x1 - drag.x0),
        h: Math.abs(drag.y1 - drag.y0),
      });
    }
    if (pendingEdge) setMouse(toScene(e.clientX, e.clientY));
  }, [isPanning, viewport, setViewport, pendingEdge, toScene]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
    const drag = marqueeRef.current;
    marqueeRef.current = null;
    setSelecting(false);
    setMarquee(null);
    if (!drag) return;
    const rect = {
      x: Math.min(drag.x0, drag.x1),
      y: Math.min(drag.y0, drag.y1),
      w: Math.abs(drag.x1 - drag.x0),
      h: Math.abs(drag.y1 - drag.y0),
    };
    if (rect.w < 6 && rect.h < 6) {
      if (!drag.additive) setPicked([]);
      setWheel(null);
      return;
    }
    const store = usePipelineStore.getState();
    const folded = new Set(store.collapsedStages);
    const hit = store.nodes.filter((node) => {
      if (node.inLane !== false && folded.has(node.stage)) {
        const members = store.nodes
          .filter((item) => item.stage === node.stage && item.inLane !== false && item.id !== store.draggingId)
          .sort((a, b) => a.slot - b.slot);
        const index = members.findIndex((item) => item.id === node.id);
        if (index < 0) return false;
        const stack = collapsedStack(members.length);
        const card = stack[index];
        const previousLip = index === 0 ? 0 : stack[index - 1].lip;
        return rectsOverlap(rect, {
          x: laneX(node.stage) + LANE_PAD_X + card.shiftX,
          y: COLLAPSED_HEADER + previousLip,
          w: NODE_W,
          h: card.lip - previousLip,
        });
      }
      const at = nodePosition(node);
      return rectsOverlap(rect, { x: at.x, y: at.y, w: NODE_W, h: NODE_H });
    }).map((node) => node.id);
    const ids = drag.additive ? Array.from(new Set([...pickedRef.current, ...hit])) : hit;
    setPicked(ids);
    const wheelOn = useSettingsStore.getState().settings.appearance.groupWheel !== false;
    if (ids.length > 0 && wheelOn) setWheel({ clientX: drag.clientX, clientY: drag.clientY, ids });
    else setWheel(null);
  }, []);

  // Explorer / OS drag-and-drop → a free picture. It joins a lane only when
  // released on one, or onto another picture (that opens the moodboard).
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const pos = toScene(e.clientX, e.clientY);

    const sources: { src: string; name: string; kind: 'explorer' | 'file' }[] = [];
    const json = e.dataTransfer.getData('application/json');
    if (json) {
      try {
        const asset = JSON.parse(json) as { name?: string; dataUrl?: string; thumbnail?: string; path?: string; type?: string };
        const src = asset.dataUrl || asset.thumbnail || (asset.path?.startsWith('/') ? asset.path : '');
        if (src) sources.push({ src, name: asset.name ?? 'Explorer asset', kind: 'explorer' });
      } catch { /* not an asset payload */ }
    }
    // Read all dropped files concurrently instead of one at a time — each
    // FileReader read is already async, so a sequential `for` loop was
    // needlessly waiting for file N before even starting to read file N+1.
    const imageFiles = Array.from(e.dataTransfer.files ?? []).filter((f) => f.type.startsWith('image/'));
    const fileSources = await Promise.all(imageFiles.map((file) =>
      new Promise<{ src: string; name: string; kind: 'file' }>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ src: reader.result as string, name: file.name, kind: 'file' });
        reader.readAsDataURL(file);
      })
    ));
    sources.push(...fileSources);

    // Create+slot every node up front (synchronous, order-sensitive), then
    // ingest all of them concurrently — ingestImage's image-decode step is
    // genuinely async even though the final canvas encode is main-thread,
    // so dropping several images no longer serializes decode-then-encode
    // one full image at a time.
    const created: { nodeId: string; source: (typeof sources)[number] }[] = [];
    sources.forEach((source, index) => {
      const node = addNode('image-import');
      if (!node) return;
      usePipelineStore.getState().renameNode(node.id, source.name.replace(/\.[a-z0-9]+$/i, ''));
      usePipelineStore.getState().placeFree(
        node.id,
        pos.x - NODE_W / 2 + index * (NODE_W + 24),
        pos.y - NODE_H / 2,
      );
      settleNode(node.id);
      created.push({ nodeId: node.id, source });
    });

    await Promise.all(created.map(async ({ nodeId, source }) => {
      try {
        const result = await ingestImage(source.src, { name: source.name, sourceKind: source.kind });
        addVariant(nodeId, {
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
        usePipelineStore.getState().setParam(nodeId, 'file', result.dataUrl);
      } catch {
        usePipelineStore.getState().removeNode(nodeId);
      }
    }));
  }, [toScene, addNode, addVariant]);

  // Payload telemetry: how heavy the workshop media currently is
  const stats = useMemo(() => payloadStats(nodes), [nodes]);

  // Fit the whole pipeline into the viewport (space optimization)
  const fitView = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || nodes.length === 0) return;
    const boxes = nodes.map((node) => nodePosition(node));
    const minX = Math.min(...boxes.map((at) => at.x)) - CLUSTER_PAD_X;
    const minY = Math.min(...boxes.map((at) => at.y)) - CLUSTER_PAD_TOP;
    const maxX = Math.max(...boxes.map((at) => at.x)) + NODE_W + CLUSTER_PAD_X;
    const maxY = Math.max(...boxes.map((at) => at.y)) + NODE_H + CLUSTER_PAD_BOTTOM;
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const pad = 48;
    const zoom = Math.min(
      1.4,
      Math.max(0.15, Math.min((rect.width - pad * 2) / width, (rect.height - pad * 2) / height))
    );
    setViewport({
      zoom,
      x: pad - minX * zoom + (rect.width - pad * 2 - width * zoom) / 2,
      y: pad - minY * zoom + (rect.height - pad * 2 - height * zoom) / 2,
    });
  }, [nodes, setViewport]);

  const viewFocus = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const current = usePipelineStore.getState().viewport;
    if (!rect || !current.zoom) return undefined;
    return {
      x: (rect.width / 2 - current.x) / current.zoom,
      y: (rect.height / 2 - current.y) / current.zoom,
      viewW: rect.width,
      viewH: rect.height,
    };
  };

  const clusters = useMemo(() => {
    const grouped = new Map<string, typeof nodes>();
    for (const node of nodes) {
      if (!node.clusterId || node.x === undefined || node.y === undefined) continue;
      const members = grouped.get(node.clusterId) ?? [];
      members.push(node);
      grouped.set(node.clusterId, members);
    }
    return [...grouped.entries()].map(([id, members]) => {
      const counts = new Map<PipelineStageId, number>();
      for (const member of members) counts.set(member.stage, (counts.get(member.stage) ?? 0) + 1);
      const stage = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const plate = members.find((member) => member.clusterFrame)?.clusterFrame
        ?? plateAround(members.map((member) => ({ x: member.x ?? 0, y: member.y ?? 0 })));
      const ordered = [...members].sort((a, b) => (a.x ?? 0) - (b.x ?? 0) || (a.y ?? 0) - (b.y ?? 0));
      return {
        id,
        stage,
        title: members.find((member) => member.clusterTitle)?.clusterTitle || STAGES[stage].title,
        icon: members.find((member) => member.clusterIcon)?.clusterIcon
          || workflowIcon(undefined, members.find((member) => member.clusterTitle)?.clusterTitle),
        collapsed: members.some((member) => member.clusterCollapsed),
        memberIds: ordered.map((member) => member.id),
        ...plate,
      };
    });
  }, [nodes]);

  useEffect(() => {
    if (clusterSpacingSettled.current) return;
    if (isLoadingProject || loadedProjectId !== currentProject.id) return;
    const live = usePipelineStore.getState();
    if (live.nodes.length === 0) return;
    clusterSpacingSettled.current = true;
    const seen = new Set<string>();
    for (const node of live.nodes) {
      if (!node.clusterId || seen.has(node.clusterId) || node.x === undefined) continue;
      seen.add(node.clusterId);
      const members = live.nodes.filter((item) => item.clusterId === node.clusterId && item.x !== undefined);
      const xs = members.map((item) => item.x ?? 0).sort((a, b) => a - b);
      let gap = Infinity;
      for (let index = 1; index < xs.length; index += 1) {
        const between = xs[index] - xs[index - 1] - NODE_W;
        if (between > 0) gap = Math.min(gap, between);
      }
      const previousDefault = Number.isFinite(gap) && Math.abs(gap - 52) < 3;
      if (xs.length < 2 || !Number.isFinite(gap) || (gap >= CLUSTER_GAP_MIN_X && !previousDefault)) continue;
      const ids = members.map((item) => item.id);
      const idSet = new Set(ids);
      const links = live.edges.filter((link) => idSet.has(link.from) && idSet.has(link.to));
      const frame = members.find((item) => item.clusterFrame)?.clusterFrame
        ?? plateAround(members.map((item) => ({ x: item.x ?? 0, y: item.y ?? 0 })));
      const packed = packCluster(ids, links);
      live.resizeCluster(node.clusterId, { x: frame.x, y: frame.y, w: packed.width, h: packed.height });
    }
  }, [nodes, isLoadingProject, loadedProjectId, currentProject.id]);

  const clusterHandleClass: Record<ClusterEdgeName, string> = {
    n: styles.clusterN,
    s: styles.clusterS,
    e: styles.clusterE,
    w: styles.clusterW,
    ne: styles.clusterNE,
    nw: styles.clusterNW,
    se: styles.clusterSE,
    sw: styles.clusterSW,
  };

  const onClusterResizeDown = (event: React.PointerEvent, clusterId: string, edge: ClusterEdgeName, frame: { x: number; y: number; w: number; h: number }) => {
    event.stopPropagation();
    event.preventDefault();
    const live = usePipelineStore.getState();
    const members = live.nodes.filter((node) => node.clusterId === clusterId);
    const ids = members.map((node) => node.id);
    const idSet = new Set(ids);
    clusterResize.current = {
      id: clusterId,
      edge,
      x: event.clientX,
      y: event.clientY,
      frame,
      min: minClusterSize(ids, live.edges.filter((link) => idSet.has(link.from) && idSet.has(link.to))),
    };
    setClusterResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onClusterResizeMove = (event: React.PointerEvent) => {
    const session = clusterResize.current;
    if (!session) return;
    const zoom = usePipelineStore.getState().viewport.zoom || 1;
    const next = resizeClusterFrame(
      session.frame,
      session.edge,
      (event.clientX - session.x) / zoom,
      (event.clientY - session.y) / zoom,
      session.min,
    );
    usePipelineStore.getState().resizeCluster(session.id, next);
  };

  const onClusterResizeUp = () => {
    if (!clusterResize.current) return;
    clusterResize.current = null;
    setClusterResizing(false);
  };

  useEffect(() => {
    if (!fitAfterOpen.current || nodes.length === 0) return;
    fitAfterOpen.current = false;
    fitView();
  }, [nodes, fitView]);

  // Lane geometry: height driven by populated slots so groups grow/shrink live
  const laneHeights = useMemo(() => {
    const heights: Partial<Record<PipelineStageId, number>> = {};
    for (const g of laneGroups) {
      const inserting = !g.collapsed && dragOverStage === g.stage && dragInsertIndex != null;
      heights[g.stage] = laneFrameHeight(g.nodeIds.length + (inserting ? 1 : 0), g.collapsed);
    }
    return heights;
  }, [laneGroups, dragOverStage, dragInsertIndex]);

  const pendingSource = pendingEdge
    ? nodes.find((n) => n.id === (pendingEdge.origin === 'input' ? pendingEdge.to : pendingEdge.from)) ?? null
    : null;
  const pendingStart = pendingSource && pendingEdge
    ? (pendingEdge.origin === 'input'
      ? inputPortPos(pendingSource, pendingEdge.toPort ?? '')
      : outputPortPos(pendingSource, pendingEdge.fromPort))
    : null;

  const trackWire = useCallback((clientX: number, clientY: number) => {
    setMouse(toScene(clientX, clientY));
  }, [toScene]);

  const openLinkMenu = useCallback((drop: WireDrop) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const inside = !!rect
      && drop.clientX >= rect.left && drop.clientX <= rect.right
      && drop.clientY >= rect.top && drop.clientY <= rect.bottom;
    const store = usePipelineStore.getState();
    const source = store.nodes.find((node) => node.id === drop.nodeId);
    if (!inside || !source) {
      store.cancelEdge();
      return;
    }
    const choices = linkCandidates(
      drop.portType,
      drop.side === 'out' ? 'input' : 'output',
      source.stage,
    );
    store.cancelEdge();
    if (choices.length === 0) return;
    setLinkWheel({ ...drop, choices });
  }, []);

  const wireHint = useMemo(() => {
    if (pendingEdge?.origin === 'output') {
      return { nodeId: pendingEdge.from, portId: pendingEdge.fromPort, side: 'out' as const, type: pendingEdge.portType, picking: true };
    }
    if (pendingEdge?.origin === 'input' && pendingEdge.to && pendingEdge.toPort) {
      return { nodeId: pendingEdge.to, portId: pendingEdge.toPort, side: 'in' as const, type: pendingEdge.portType, picking: true };
    }
    if (linkWheel) {
      return { nodeId: linkWheel.nodeId, portId: linkWheel.portId, side: linkWheel.side, type: linkWheel.portType, picking: false };
    }
    return null;
  }, [pendingEdge, linkWheel]);

  const collapsedWiring = useMemo(() => {
    const map = new Map<PipelineStageId, ReturnType<typeof wiringFor>>();
    for (const group of laneGroups) {
      if (!group.collapsed) continue;
      map.set(group.stage, wiringFor(group.nodeIds, nodes, edges));
    }
    return map;
  }, [laneGroups, nodes, edges]);

  const collapsedNodeIds = useMemo(() => {
    const hidden = new Set<string>();
    for (const g of laneGroups) if (g.collapsed) g.nodeIds.forEach((id) => hidden.add(id));
    return hidden;
  }, [laneGroups]);

  const foldedClusterIds = useMemo(() => {
    const hidden = new Set<string>();
    for (const cluster of clusters) if (cluster.collapsed) cluster.memberIds.forEach((id) => hidden.add(id));
    return hidden;
  }, [clusters]);

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
              <input
                className={styles.addMenuSearch}
                value={addQuery}
                placeholder="Find a group or a node"
                onChange={(event) => setAddQuery(event.target.value)}
                autoFocus
              />
              {STAGE_ORDER.map((stageId) => {
                const stage = STAGES[stageId];
                const stageColor = settings.appearance?.stageLaneColors?.[stageId] || stage.color;
                const query = addQuery.trim().toLowerCase();
                const groupMatch = !query || `${stage.title} ${stage.tagline}`.toLowerCase().includes(query);
                const defs = nodesForStage(stageId).filter((def) => (
                  !query || groupMatch || `${def.title} ${def.subtitle}`.toLowerCase().includes(query)
                ));
                if (query && !groupMatch && defs.length === 0) return null;
                const opened = openStages.includes(stageId) || laneGroups.some((group) => group.stage === stageId);
                return (
                  <div
                    key={stageId}
                    className={styles.addMenuStage}
                    style={{ ['--stage-color' as string]: stageColor }}
                  >
                    <button
                      type="button"
                      className={styles.addMenuStageTitle}
                      onClick={() => { openStage(stageId); setShowAddMenu(false); setAddQuery(''); }}
                      title={`Open the ${stage.title} group on the canvas`}
                    >
                      <span className={styles.addMenuStageDot} />
                      <span>
                        <span className={styles.addMenuGroupName}>{stage.title}</span>
                        <span className={styles.addMenuItemSub}>{stage.tagline}</span>
                      </span>
                      <span className={styles.addMenuOpen}>{opened ? 'On canvas' : 'Add group'}</span>
                    </button>
                    {defs.map((def) => (
                      <button
                        key={def.type}
                        className={styles.addMenuItem}
                        onClick={() => { addNode(def.type); setShowAddMenu(false); setAddQuery(''); }}
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

        <button className={styles.tbtn} onClick={() => setShowWorkflowPicker(true)} title="Starting graphs, saved copies, and graphs you named">
          <FolderClock size={14} /> Workflows
        </button>

        <div className={styles.divider} />

        <button
          className={styles.tbtn}
          disabled={undoDepth === 0}
          onClick={() => usePipelineStore.getState().undo()}
          title={undoLabel
            ? `Undo: ${undoLabel} (${formatShortcut(settings.shortcuts?.undo ?? 'mod+z')})`
            : `Undo (${formatShortcut(settings.shortcuts?.undo ?? 'mod+z')})`}
          aria-label="Undo"
        >
          <Undo2 size={14} />
        </button>

        <button className={styles.tbtn} onClick={() => setViewport({ ...viewport, zoom: Math.min(2.5, viewport.zoom * 1.2) })}>
          <ZoomIn size={14} />
        </button>
        <span className={styles.zoomLabel}>{Math.round(viewport.zoom * 100)}%</span>
        <button className={styles.tbtn} onClick={() => setViewport({ ...viewport, zoom: Math.max(0.2, viewport.zoom / 1.2) })}>
          <ZoomOut size={14} />
        </button>
        <button
          className={styles.tbtn}
          title={viewFitted ? 'Precise view' : 'Fit whole pipeline in view'}
          onClick={() => {
            if (viewFitted) {
              setViewport({ x: 60, y: 40, zoom: 0.85 });
              setViewFitted(false);
            } else {
              fitView();
              setViewFitted(true);
            }
          }}
        >
          {viewFitted ? <Maximize size={14} /> : <Scan size={14} />}
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
          disabled={!deleteTarget}
          title={deleteTarget ? `Delete ${deleteTarget.label}` : 'Select a node or a group'}
          aria-label={deleteTarget ? `Delete ${deleteTarget.label}` : 'Delete selection'}
          onClick={() => {
            if (!deleteTarget) return;
            if (deleteTarget.ids.length > 1) {
              const confirmed = window.confirm(`Delete ${deleteTarget.label}? Undo can bring it back.`);
              if (!confirmed) return;
            }
            usePipelineStore.getState().removeNodes(deleteTarget.ids);
            if (selectedLane) closeStage(selectedLane);
            setSelectedClusterId(null);
            setSelectedLane(null);
            setPicked([]);
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* ── Canvas ── */}
      <div
        ref={canvasRef}
        className={`${styles.canvas} ${isPanning ? styles.panning : ''} ${selecting ? styles.selecting : ''} ${pendingEdge ? styles.connecting : ''}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={(event) => {
          if (!pendingEdge && !linkWheel) return;
          event.preventDefault();
          cancelEdge();
          setLinkWheel(null);
        }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDrop={(e) => void handleDrop(e)}
      >
        <WorkshopOverview
          nodes={nodes}
          scenes={scenes}
          viewport={viewport}
          setViewport={setViewport}
          canvasRef={canvasRef}
        />
        <div
          className={styles.grid}
          style={{ backgroundPosition: `${viewport.x}px ${viewport.y}px`, backgroundSize: `${28 * viewport.zoom}px ${28 * viewport.zoom}px` }}
        />

        <div
          className={styles.scene}
          data-cluster-resize={clusterResizing ? '' : undefined}
          style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}
        >
          {/* Stage lanes — auto-formed groups */}
          {laneGroups.map((group) => {
            const stage = STAGES[group.stage];
            const stageColor = settings.appearance?.stageLaneColors?.[group.stage] || stage.color;
            const wiring = group.collapsed ? collapsedWiring.get(group.stage) : undefined;
            return (
              <div
                key={group.id}
                className={`${styles.lane} ${group.collapsed ? styles.laneCollapsed : ''} ${dragOverStage === group.stage ? styles.laneHot : ''} ${selectedLane === group.stage ? styles.groupSelected : ''}`}
                style={{
                  left: laneX(group.stage),
                  top: 0,
                  width: LANE_WIDTH,
                  height: laneHeights[group.stage],
                  ['--stage-color' as string]: stageColor,
                }}
                onPointerDown={(event) => { if (group.collapsed) event.stopPropagation(); }}
                onClick={() => {
                  if (!group.collapsed) return;
                  setSelectedLane(group.stage);
                  setSelectedClusterId(null);
                  setPicked([]);
                  select(null);
                  toggleGroupCollapsed(group.stage);
                }}
              >
                {group.collapsed && group.nodeIds.map((id, index) => {
                  const member = nodes.find((node) => node.id === id);
                  if (!member) return null;
                  return (
                    <PipelineNodeCard
                      key={id}
                      node={member}
                      zoom={viewport.zoom}
                      apiKey={apiKey}
                      foldIndex={index}
                      foldCount={group.nodeIds.length}
                    />
                  );
                })}
                <div
                  className={styles.laneHeader}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedLane(group.stage);
                    setSelectedClusterId(null);
                    setPicked([]);
                    select(null);
                    toggleGroupCollapsed(group.stage);
                  }}
                >
                  <span className={styles.laneIcon}>{nodeIcon(stage.icon, 16)}</span>
                  <div>
                    <div className={styles.laneTitle}>{stage.title}</div>
                    <div className={styles.laneTagline}>
                      {wiring
                        ? `${wiring.external} external · ${wiring.internal} internal`
                        : stage.tagline}
                    </div>
                  </div>
                  <span className={styles.laneCount}>{group.nodeIds.length}</span>
                  {openStages.includes(group.stage) && group.nodeIds.length === 0 && (
                    <button
                      type="button"
                      className={styles.laneDismiss}
                      title="Remove this empty group"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => { event.stopPropagation(); closeStage(group.stage); }}
                    >
                      ×
                    </button>
                  )}
                  <ChevronRight size={14} className={styles.laneChevron} style={{ transform: group.collapsed ? undefined : 'rotate(90deg)' }} />
                </div>
              </div>
            );
          })}

          {clusters.map((cluster) => {
            const stage = STAGES[cluster.stage];
            const stageColor = settings.appearance?.stageLaneColors?.[cluster.stage] || stage.color;
            const closed = collapsedClusterSize(cluster.memberIds.length);
            const toggle = (event: React.MouseEvent) => {
              event.stopPropagation();
              usePipelineStore.getState().toggleClusterCollapsed(cluster.id);
            };
            return (
              <div
                key={cluster.id}
                className={`${styles.cluster} ${cluster.collapsed ? styles.clusterCollapsed : ''} ${selectedClusterId === cluster.id ? styles.groupSelected : ''}`}
                style={{
                  left: cluster.x,
                  top: cluster.y,
                  width: cluster.collapsed ? closed.w : cluster.w,
                  height: cluster.collapsed ? closed.h : cluster.h,
                  ['--stage-color' as string]: stageColor,
                }}
                onPointerDown={(event) => { if (cluster.collapsed) event.stopPropagation(); }}
                onClick={(event) => {
                  if (!cluster.collapsed) return;
                  setSelectedClusterId(cluster.id);
                  setSelectedLane(null);
                  setPicked([]);
                  select(null);
                  toggle(event);
                }}
              >
                {cluster.collapsed && cluster.memberIds.map((id, index) => {
                  const member = nodes.find((node) => node.id === id);
                  if (!member) return null;
                  return (
                    <PipelineNodeCard
                      key={id}
                      node={member}
                      zoom={viewport.zoom}
                      apiKey={apiKey}
                      foldIndex={index}
                      foldCount={cluster.memberIds.length}
                    />
                  );
                })}
                <div
                  className={styles.clusterHeader}
                  style={{ height: cluster.collapsed ? COLLAPSED_HEADER : CLUSTER_HEADER, zIndex: cluster.collapsed ? 30 : undefined }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    setSelectedClusterId(cluster.id);
                    setSelectedLane(null);
                    setPicked([]);
                    select(null);
                    toggle(event);
                  }}
                >
                  <span className={styles.clusterIcon}>{nodeIcon(cluster.icon, 13)}</span>
                  <div className={styles.clusterTitle}>{cluster.title}</div>
                  <ChevronRight size={14} className={styles.clusterChevron} style={{ transform: cluster.collapsed ? undefined : 'rotate(90deg)' }} />
                </div>
                {!cluster.collapsed && (Object.keys(clusterHandleClass) as ClusterEdgeName[]).map((edge) => (
                  <div
                    key={edge}
                    role="button"
                    aria-label={`Resize ${cluster.title} ${edge}`}
                    className={`${styles.clusterHandle} ${clusterHandleClass[edge]}`}
                    onPointerDown={(event) => onClusterResizeDown(event, cluster.id, edge, cluster)}
                    onPointerMove={onClusterResizeMove}
                    onPointerUp={onClusterResizeUp}
                    onPointerCancel={onClusterResizeUp}
                  />
                ))}
              </div>
            );
          })}

          {/* Edges */}
          <svg className={styles.edgeSvg} width={1} height={1}>
            {edges.map((edge) => {
              const from = nodes.find((n) => n.id === edge.from);
              const to = nodes.find((n) => n.id === edge.to);
              if (!from || !to) return null;
              const fromFolded = from.inLane !== false && collapsedNodeIds.has(from.id);
              const toFolded = to.inLane !== false && collapsedNodeIds.has(to.id);
              if (fromFolded && toFolded && from.stage === to.stage) return null;
              const fromCluster = from.clusterCollapsed ? clusters.find((cluster) => cluster.id === from.clusterId) : undefined;
              const toCluster = to.clusterCollapsed ? clusters.find((cluster) => cluster.id === to.clusterId) : undefined;
              if (fromCluster && toCluster && fromCluster.id === toCluster.id) return null;
              const foldedEnd = (node: typeof from, side: 'in' | 'out') => {
                const wiring = collapsedWiring.get(node.stage);
                const list = side === 'out' ? wiring?.outputs : wiring?.inputs;
                const index = list?.findIndex((cycle) => cycle.edgeIds.includes(edge.id) && cycle.role === 'external') ?? -1;
                if (!wiring || !list || index < 0) return null;
                return cyclePointForStage(node.stage, laneHeights[node.stage] ?? COLLAPSED_HEADER, side, index, list.length);
              };
              const clusterEnd = (cluster: { x: number; y: number; w: number; memberIds: string[] }, side: 'in' | 'out') => {
                const closed = collapsedClusterSize(cluster.memberIds.length);
                return {
                  x: side === 'out' ? cluster.x + closed.w : cluster.x,
                  y: cluster.y + COLLAPSED_HEADER / 2,
                };
              };
              const p1 = fromCluster
                ? clusterEnd(fromCluster, 'out')
                : fromFolded ? foldedEnd(from, 'out') : outputPortPos(from, edge.fromPort);
              const p2 = toCluster
                ? clusterEnd(toCluster, 'in')
                : toFolded ? foldedEnd(to, 'in') : inputPortPos(to, edge.toPort);
              if (!p1 || !p2) return null;
              const d = edgePath(p1.x, p1.y, p2.x, p2.y);
              const color = PORT_COLORS[edge.type] ?? '#8a8aa2';
              return (
                <g key={edge.id}>
                  <path className={styles.edgeGlow} d={d} stroke={color} />
                  <path
                    className={styles.edgeHit}
                    d={d}
                    onClick={(e) => { e.stopPropagation(); removeEdge(edge.id); }}
                  >
                    <title>Click to remove link</title>
                  </path>
                  <path className={styles.edgePath} d={d} stroke={color} />
                </g>
              );
            })}
            {pendingStart && pendingEdge && (() => {
              const from = pendingEdge.origin === 'input' ? mouse : pendingStart;
              const to = pendingEdge.origin === 'input' ? pendingStart : mouse;
              const d = edgePath(from.x, from.y, to.x, to.y);
              const color = PORT_COLORS[pendingEdge.portType] ?? '#cbd5e1';
              return (
                <g>
                  <path className={styles.edgeGlow} d={d} stroke={color} />
                  <path className={styles.pendingPath} d={d} stroke={color} />
                </g>
              );
            })()}
          </svg>

          {laneGroups.map((group) => {
            const wiring = collapsedWiring.get(group.stage);
            if (!wiring) return null;
            return [...wiring.inputs, ...wiring.outputs].map((cycle) => {
              const list = cycle.side === 'in' ? wiring.inputs : wiring.outputs;
              const index = list.indexOf(cycle);
              const at = cyclePointForStage(
                group.stage,
                laneHeights[group.stage] ?? COLLAPSED_HEADER,
                cycle.side,
                index,
                list.length,
              );
              return (
                <span
                  key={`${group.stage}-${cycle.key}`}
                  className={`${styles.laneCycle} ${cycle.role === 'empty' ? styles.laneCycleEmpty : styles.laneCycleOn} ${cycle.role === 'internal' ? styles.laneCycleInternal : ''}`}
                  style={{
                    left: at.x,
                    top: at.y,
                    ['--port-color' as string]: PORT_COLORS[cycle.type] ?? '#8a8aa2',
                  }}
                  title={cycle.role === 'empty' ? 'Open port' : cycle.role === 'internal' ? 'Internal link' : 'External link'}
                />
              );
            });
          })}

          {/* Nodes */}
          {marquee && (
            <div className={styles.marquee} style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />
          )}

          {nodes
            .filter((n) => !collapsedNodeIds.has(n.id) && !foldedClusterIds.has(n.id))
            .map((node) => {
              const push = node.inLane !== false
                && node.id !== draggingId
                && dragOverStage === node.stage
                && dragInsertIndex != null
                && node.slot >= dragInsertIndex
                && !collapsedNodeIds.has(node.id);
              return (
                <PipelineNodeCard
                  key={node.id}
                  node={node}
                  zoom={viewport.zoom}
                  apiKey={apiKey}
                  shiftY={push ? NODE_H + NODE_GAP : 0}
                  marked={picked.includes(node.id)}
                  wire={wireHint}
                  panKeyRef={spaceRef}
                  onWireMove={trackWire}
                  onLinkMenu={openLinkMenu}
                />
              );
            })}
        </div>

        {(linkWheel || wheel) && (() => {
          const rect = canvasRef.current?.getBoundingClientRect();
          const size = 280;
          const room = 28;
          const point = linkWheel ?? wheel;
          if (!point) return null;
          const left = rect
            ? placeWheel(point.clientX, rect.left, rect.width, size / 2 + room, size / 2 + room)
            : point.clientX;
          const top = rect
            ? placeWheel(point.clientY, rect.top, rect.height, size / 2 + room, size / 2 + room)
            : point.clientY;
          const edge = 16;
          const stripTop = canvasRef.current?.parentElement?.querySelector('[data-film-strip]')?.getBoundingClientRect().top;
          const usableBottom = rect && stripTop != null ? Math.min(rect.bottom, stripTop) : rect?.bottom;
          const space = rect && usableBottom != null ? {
            minX: edge - (left - size / 2),
            minY: edge - (top - size / 2),
            maxX: rect.width - edge - (left - size / 2),
            maxY: usableBottom - rect.top - edge - (top - size / 2),
          } : undefined;
          const colorOf = (stageId: PipelineStageId) => (
            settings.appearance?.stageLaneColors?.[stageId] || STAGES[stageId].color
          );
          const frame = { left, top, width: size, height: size };
          if (linkWheel) {
            return (
              <ChoiceWheel
                slices={linkWheelSlices(linkWheel.choices, colorOf)}
                style={frame}
                space={space}
                onCancel={() => setLinkWheel(null)}
                onPick={(stageId, type) => {
                  const choice = linkWheel.choices.find((item) => item.type === type && item.stage === stageId);
                  if (!choice) return;
                  usePipelineStore.getState().spawnLinkedNode({
                    type: choice.type,
                    newPortId: choice.portId,
                    sourceId: linkWheel.nodeId,
                    sourcePortId: linkWheel.portId,
                    sourceSide: linkWheel.side,
                  });
                  setLinkWheel(null);
                }}
              />
            );
          }
          return (
            <ChoiceWheel
              slices={STAGE_ORDER.map((stageId) => {
                const stage = STAGES[stageId];
                const color = colorOf(stageId);
                return {
                  id: stageId,
                  label: stage.title,
                  icon: stage.icon,
                  color,
                  options: [
                    { id: '__place', label: 'Place selection', hint: stage.tagline, icon: stage.icon, color },
                    ...nodesForStage(stageId).map((def) => ({
                      id: def.type,
                      label: def.title,
                      hint: def.subtitle,
                      icon: def.icon,
                      color,
                    })),
                  ],
                };
              })}
              style={frame}
              space={space}
              onCancel={() => { setWheel(null); setPicked([]); }}
              onPick={(stageId, optionId) => {
                const stage = stageId as PipelineStageId;
                if (optionId === '__place') {
                  const store = usePipelineStore.getState();
                  const ordered = [...wheel!.ids].sort((a, b) => {
                    const leftNode = store.nodes.find((node) => node.id === a);
                    const rightNode = store.nodes.find((node) => node.id === b);
                    if (!leftNode || !rightNode) return 0;
                    const pa = nodePosition(leftNode);
                    const pb = nodePosition(rightNode);
                    return pa.y - pb.y || pa.x - pb.x;
                  });
                  openStage(stage);
                  ordered.forEach((id) => usePipelineStore.getState().joinLane(id, stage));
                } else {
                  openStage(stage);
                  addNode(optionId);
                }
                setWheel(null);
                setPicked([]);
              }}
            />
          );
        })()}

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
              onClick={() => setShowWorkflowPicker(true)}
            >
              ✨ Choose a starting workflow
            </button>
          </div>
        )}

        {showWorkflowPicker && (
          <WorkflowPicker
            projectId={currentProject.id}
            projectName={currentProject.name}
            nodeCount={nodes.length}
            onClose={() => setShowWorkflowPicker(false)}
            onFullPipeline={(mode) => {
              fitAfterOpen.current = true;
              if (mode === 'replace') usePipelineStore.getState().clearAll();
              usePipelineStore.getState().seedStarterFlow({ beside: mode === 'insert' });
              setShowWorkflowPicker(false);
            }}
            onApply={(spec: BlueprintSpec, mode) => {
              if (mode === 'replace') fitAfterOpen.current = true;
              usePipelineStore.getState().applyBlueprint(specToBlueprint(spec), mode, viewFocus());
              setShowWorkflowPicker(false);
            }}
            onApplySaved={(id, mode) => {
              const blueprint = useBlueprintStore.getState().blueprints.find((item) => item.id === id);
              if (!blueprint) return;
              if (mode === 'replace') fitAfterOpen.current = true;
              usePipelineStore.getState().applyBlueprint(blueprint, mode, viewFocus());
              setShowWorkflowPicker(false);
            }}
            onLoadedSnapshot={() => {
              fitAfterOpen.current = true;
              setShowWorkflowPicker(false);
            }}
          />
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
