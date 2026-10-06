import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  PipelineNode, PipelineEdge, PipelineGroup, PipelineViewport,
  PipelineStageId, NodeVariant, BananaRequest, BananaResponse,
  AssetLayer, LayerKind, SceneRef, ParamTemplate,
} from '@/types/pipeline';
import type { Blueprint } from '@/types/blueprint';
import { compileBlueprint, workflowIcon } from '@/lib/pipeline/blueprintBridge';
import { rectsOverlap, showStageLane } from '@/lib/pipeline/lanes';
import { CLUSTER_PAD_TOP, CLUSTER_PAD_X, findClusterOrigin, packCluster, placeCluster, type ClusterRect } from '@/lib/pipeline/clusterLayout';
import {
  PIPELINE_NODE_DEFS, STAGES, STAGE_ORDER, defaultParams, buildPrompt, portsCompatible,
} from '@/lib/pipeline/catalog';
import { createLayer, compositeVariant, layerDirectives, transformImage, type ImageTransformOptions } from '@/lib/pipeline/layers';
import { useLogStore } from '@/stores/logStore';

// ── Auto-layout constants (stage lanes → horizontal; slots → vertical) ──────
export const LANE_WIDTH = 324;
export const LANE_GAP = 62;
export const LANE_HEADER = 68;
export const NODE_W = 292;
export const NODE_H = 200;
export const NODE_GAP = 30;
export const LANE_PAD_X = (LANE_WIDTH - NODE_W) / 2;

export function laneX(stage: PipelineStageId): number {
  return STAGES[stage].order * (LANE_WIDTH + LANE_GAP);
}

export function nodePosition(node: PipelineNode): { x: number; y: number } {
  if (node.x !== undefined && node.y !== undefined) return { x: node.x, y: node.y };
  return {
    x: laneX(node.stage) + LANE_PAD_X,
    y: LANE_HEADER + node.slot * (NODE_H + NODE_GAP),
  };
}

/** Renumber lane members 0..n-1 so a removed node cannot leave a hole in the stack. */
function compactInLane(nodes: PipelineNode[], exceptId?: string | null): PipelineNode[] {
  const slotOf = new Map<string, number>();
  for (const stage of STAGE_ORDER) {
    const members = nodes
      .filter((node) => node.stage === stage && node.inLane !== false && node.id !== exceptId)
      .sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id));
    members.forEach((member, index) => slotOf.set(member.id, index));
  }
  let changed = false;
  const next = nodes.map((node) => {
    const slot = slotOf.get(node.id);
    if (slot === undefined) return node;
    if (slot === node.slot && node.x === undefined && node.y === undefined) return node;
    changed = true;
    return { ...node, slot, x: undefined, y: undefined };
  });
  return changed ? next : nodes;
}

interface PendingEdge {
  from: string;
  fromPort: string;
  portType: string;
  /** `output` starts on a right-hand port. `input` starts on a left-hand port. */
  origin: 'output' | 'input';
  to?: string;
  toPort?: string;
}

export interface PipelineSnapshotMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
  sceneCount: number;
}

/** Exported for the sync engine, which must drop a stale cached copy after a pull. */
export function pipelineStorageKey(projectId: string): string {
  return `ars:pipeline-workshop:${projectId}`;
}

interface PipelineState {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  viewport: PipelineViewport;
  selectedId: string | null;
  pendingEdge: PendingEdge | null;
  isRunning: boolean;
  runningNodeIds: string[];
  /** Node whose picture should sit behind the graph after the last cook. */
  lastCookedNodeId: string | null;

  // per-project persistence (Workshop state is scoped to whichever project is open)
  currentProjectId: string | null;
  currentProjectName: string;
  isLoadingProject: boolean;
  loadForProject: (projectId: string, projectName?: string) => Promise<void>;
  /** Forces an immediate (non-debounced) save — use for unmount/beforeunload. */
  saveForProject: (projectId: string, projectName: string) => void;

  // named workflow snapshots (the "workflow submenu" — save/restore multiple
  // named states per project, in addition to the always-current draft above)
  listSnapshots: (projectId: string) => Promise<PipelineSnapshotMeta[]>;
  saveSnapshot: (projectId: string, projectName: string, name: string) => Promise<void>;
  loadSnapshot: (projectId: string, snapshotId: string) => Promise<void>;
  renameSnapshot: (projectId: string, snapshotId: string, name: string) => Promise<void>;
  deleteSnapshot: (projectId: string, snapshotId: string) => Promise<void>;

  // node ops
  addNode: (type: string) => PipelineNode | null;
  removeNode: (id: string) => void;
  removeNodes: (ids: string[]) => void;
  renameNode: (id: string, title: string) => void;
  setParam: (id: string, key: string, value: unknown) => void;
  moveNodeToSlot: (id: string, stage: PipelineStageId, slot: number) => void;
  setNodePosition: (id: string, x: number, y: number) => void;
  /** Leaves the node on the open canvas, outside every stage lane. */
  placeFree: (id: string, x: number, y: number) => void;
  /** Stage lane currently under a dragged node, for the highlight. Not saved. */
  dragOverStage: PipelineStageId | null;
  /** Index the dragged node would take in that lane. Not saved. */
  dragInsertIndex: number | null;
  setDragTarget: (stage: PipelineStageId | null, index: number | null) => void;
  /** Node currently following the pointer. Excluded from the lane stack. Not saved. */
  draggingId: string | null;
  setDraggingNode: (id: string | null) => void;
  /** Puts the node in a stage lane at `index` and clears a free position. */
  joinLane: (id: string, stage: PipelineStageId, index?: number) => void;
  /** If the moodboard would hold fewer than two pictures, let the last one go. */
  releaseSparseMoodboard: () => void;
  /** Close holes left by older slot numbers so the border matches the stack. */
  compactLanes: () => void;
  resetNodePosition: (id: string) => void;
  toggleDeck: (id: string) => void;
  setCollapsed: (id: string, collapsed: boolean) => void;

  // variants (vertical stacking)
  addVariant: (nodeId: string, variant: Omit<NodeVariant, 'id' | 'createdAt'>) => NodeVariant;
  selectVariant: (nodeId: string, variantId: string) => void;
  removeVariant: (nodeId: string, variantId: string) => void;
  pinVariant: (nodeId: string, variantId: string) => void;
  updateVariant: (nodeId: string, variantId: string, patch: Partial<NodeVariant>) => void;

  // layers (Photoshop-style, per variant)
  addLayer: (nodeId: string, variantId: string, kind: LayerKind, partial?: Partial<AssetLayer>) => AssetLayer;
  updateLayer: (nodeId: string, variantId: string, layerId: string, patch: Partial<AssetLayer>) => void;
  removeLayer: (nodeId: string, variantId: string, layerId: string) => void;
  duplicateLayer: (nodeId: string, variantId: string, layerId: string) => void;
  reorderLayer: (nodeId: string, variantId: string, layerId: string, dir: 1 | -1) => void;
  /** Flattens image + layers into a new variant (next version). */
  flattenVariant: (nodeId: string, variantId: string) => Promise<void>;
  /** Crop/resize/re-encode the variant image into a new version. */
  transformVariant: (nodeId: string, variantId: string, opts: ImageTransformOptions) => Promise<void>;
  /** Duplicates a version as an editable draft (layers included). */
  duplicateVariant: (nodeId: string, variantId: string) => void;
  /** Edits the text content of a version (script, shot list…). */
  setVariantText: (nodeId: string, variantId: string, text: string) => void;
  /** Applies a retouch operation (banana2 image-edit) to a version → new version. */
  retouchVariant: (nodeId: string, variantId: string, opLabel: string, instruction: string, apiKey: string) => Promise<void>;

  // edges
  startEdge: (nodeId: string, portId: string, portType: string, side: 'in' | 'out') => void;
  completeEdge: (nodeId: string, portId: string, portType: string, side: 'in' | 'out') => boolean;
  /** Creates a node, places it with its parent, and links the port the drag started from. */
  spawnLinkedNode: (spec: {
    type: string;
    newPortId: string;
    sourceId: string;
    sourcePortId: string;
    sourceSide: 'in' | 'out';
  }) => string | null;
  cancelEdge: () => void;
  removeEdge: (id: string) => void;

  // selection / viewport
  select: (id: string | null) => void;
  setViewport: (v: PipelineViewport) => void;

  // layer editor modal
  editorNodeId: string | null;
  openEditor: (nodeId: string) => void;
  closeEditor: () => void;

  // film strip — ordered scenes of the final video
  scenes: SceneRef[];
  stripOpen: boolean;
  toggleStrip: () => void;
  addSceneFromNode: (nodeId: string) => void;
  removeScene: (sceneId: string) => void;
  moveScene: (sceneId: string, dir: 1 | -1) => void;
  updateScene: (sceneId: string, patch: Partial<SceneRef>) => void;

  // prompt templates — reproducible parameter recipes per node type
  paramTemplates: ParamTemplate[];
  saveTemplate: (nodeId: string, name: string) => void;
  applyTemplate: (nodeId: string, templateName: string) => void;
  deleteTemplate: (nodeType: string, templateName: string) => void;

  // groups (auto-formed, one per populated stage)
  groups: () => PipelineGroup[];
  toggleGroupCollapsed: (stage: PipelineStageId) => void;
  collapsedStages: PipelineStageId[];
  /** Stages the user opened from the add menu, kept even while empty. */
  openStages: PipelineStageId[];
  openStage: (stage: PipelineStageId) => void;
  closeStage: (stage: PipelineStageId) => void;

  // execution
  runNode: (id: string, apiKey: string) => Promise<void>;
  runAll: (apiKey: string) => Promise<void>;
  stopRun: () => void;
  /** Drops errors left by retired Gemini ids so the node can be run again. */
  clearRetiredModelErrors: () => void;

  /** How many workshop edits can be returned. Not persisted. */
  undoDepth: number;
  /** Sentence for the edit Undo will return, or null when the stack is empty. */
  undoLabel: string | null;
  undo: () => void;

  // graph helpers
  seedStarterFlow: (options?: { beside?: boolean }) => void;
  /** Drops a saved blueprint onto this workshop. `insert` keeps the current nodes. */
  applyBlueprint: (
    blueprint: Blueprint,
    mode: 'replace' | 'insert',
    focus?: { x: number; y: number; viewW?: number; viewH?: number },
  ) => string[];
  /** Reflow every card in a workflow plate so they fill the new frame. */
  resizeCluster: (clusterId: string, frame: ClusterRect) => void;
  /** Fold or open a workflow plate, the same way a stage group folds. */
  toggleClusterCollapsed: (clusterId: string) => void;
  clearAll: () => void;
}

/** Active output payload of a node (text or image) for downstream consumption. */
const RETIRED_MODEL_ERROR = /banana2 generation failed|no longer available|models\/gemini-2\.0-flash|model is not available/i;

function withoutRetiredModelError(node: PipelineNode): PipelineNode {
  if (!node.error || !RETIRED_MODEL_ERROR.test(node.error)) return node;
  const next = { ...node, error: undefined };
  if (next.status === 'error') next.status = 'idle';
  return next;
}

/**
 * Every node entering the store (localStorage, disk, or another device via sync)
 * passes here. Nodes written by another version of the app may lack fields the
 * UI iterates — a node without `variants` crashed the whole dashboard.
 */
function normalizeLoadedNode(node: PipelineNode): PipelineNode {
  const safe = Array.isArray(node.variants) ? node : { ...node, variants: [] };
  return withoutRetiredModelError(safe);
}

function activeVariant(node: PipelineNode): NodeVariant | undefined {
  return node.variants.find((v) => v.id === node.activeVariantId) ?? node.variants[0];
}

async function callBanana(req: BananaRequest): Promise<BananaResponse> {
  const resp = await fetch('/api/pipeline/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const data = (await resp.json()) as BananaResponse;
  if (!resp.ok) throw new Error(data.error || `Generation failed (${resp.status})`);
  return data;
}

const EMPTY_VIEWPORT: PipelineViewport = { x: 60, y: 40, zoom: 0.85 };

// ── Debounced, dirty-checked autosave ───────────────────────────────────────
// Mirrors stores/canvasStore.ts's schedulePersist: only serialize+write when
// something persisted-relevant actually changed, and coalesce rapid changes
// (e.g. dragging a node, typing a param) into one write every DEBOUNCE_MS
// instead of firing on a blind interval regardless of activity.
const PERSIST_DEBOUNCE_MS = 2000;
let _pipelinePersistTimer: ReturnType<typeof setTimeout> | null = null;

function buildPersistPayload(s: PipelineState) {
  return {
    nodes: s.nodes.map((n) => ({ ...n, status: 'idle' as const })),
    edges: s.edges,
    viewport: s.viewport,
    collapsedStages: s.collapsedStages,
    openStages: s.openStages,
    scenes: s.scenes,
    paramTemplates: s.paramTemplates,
    lastCookedNodeId: s.lastCookedNodeId,
  };
}

/** Writes localStorage + disk from ONE serialized payload (not two). */
function persistNow(projectId: string, projectName: string, payload: ReturnType<typeof buildPersistPayload>) {
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify(payload);
  try {
    localStorage.setItem(pipelineStorageKey(projectId), serialized);
  } catch {
    // Quota errors are non-fatal — the disk save below still runs.
  }
  fetch('/api/workspace/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, projectName, pipeline: payload }),
  }).catch(() => {});
}

function schedulePipelinePersist() {
  if (typeof window === 'undefined') return;
  if (_pipelinePersistTimer) clearTimeout(_pipelinePersistTimer);
  _pipelinePersistTimer = setTimeout(() => {
    _pipelinePersistTimer = null;
    const s = usePipelineStore.getState();
    if (s.isLoadingProject || !s.currentProjectId) return;
    persistNow(s.currentProjectId, s.currentProjectName, buildPersistPayload(s));
  }, PERSIST_DEBOUNCE_MS);
}

const UNDO_LIMIT = 40;
const UNDO_GROUP_MS = 160;

interface UndoEntry {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  scenes: SceneRef[];
  collapsedStages: PipelineStageId[];
  selectedId: string | null;
  lastCookedNodeId: string | null;
}

const undoStack: UndoEntry[] = [];
const undoLabels: string[] = [];
let undoGroup: { baseline: UndoEntry; timer: ReturnType<typeof setTimeout> } | null = null;
let restoringUndo = false;

function describeEdit(before: UndoEntry, after: PipelineState): string {
  const beforeIds = new Set(before.nodes.map((node) => node.id));
  const afterIds = new Set(after.nodes.map((node) => node.id));
  const added = after.nodes.filter((node) => !beforeIds.has(node.id));
  const removed = before.nodes.filter((node) => !afterIds.has(node.id));
  if (before.nodes.length > 0 && after.nodes.length === 0) return 'Cleared the workshop';
  if (added.length === 1 && removed.length === 0) return `Added ${added[0].title}`;
  if (removed.length === 1 && added.length === 0) return `Removed ${removed[0].title}`;
  if (added.length > 1 && removed.length === 0) return `Added ${added.length} nodes`;
  if (removed.length > 1 && added.length === 0) {
    const clusterId = removed[0].clusterId;
    if (clusterId && removed.every((node) => node.clusterId === clusterId)) {
      return `Removed ${removed[0].clusterTitle || 'a workflow'}`;
    }
    return `Removed ${removed.length} nodes`;
  }
  if (added.length > 0 && removed.length > 0) return `Loaded a blueprint (${added.length} nodes)`;

  const beforeEdgeIds = new Set(before.edges.map((edge) => edge.id));
  const afterEdgeIds = new Set(after.edges.map((edge) => edge.id));
  const linked = after.edges.filter((edge) => !beforeEdgeIds.has(edge.id));
  const unlinked = before.edges.filter((edge) => !afterEdgeIds.has(edge.id));
  if (linked.length === 1 && unlinked.length === 0) {
    const edge = linked[0];
    const from = after.nodes.find((node) => node.id === edge.from)?.title ?? 'a node';
    const to = after.nodes.find((node) => node.id === edge.to)?.title ?? 'a node';
    return `Linked ${from} to ${to}`;
  }
  if (unlinked.length >= 1 && linked.length === 0) return unlinked.length === 1 ? 'Removed a link' : `Removed ${unlinked.length} links`;

  for (const node of after.nodes) {
    const prev = before.nodes.find((item) => item.id === node.id);
    if (!prev) continue;
    if (prev.title !== node.title) return `Renamed ${prev.title}`;
    if (prev.x !== node.x || prev.y !== node.y || prev.slot !== node.slot) return `Moved ${node.title}`;
    if (prev.params !== node.params) return `Edited ${node.title}`;
    if (prev.variants !== node.variants || prev.activeVariantId !== node.activeVariantId) return `Updated ${node.title}`;
    if (prev.clusterCollapsed !== node.clusterCollapsed) return node.clusterCollapsed ? 'Closed a workflow' : 'Opened a workflow';
  }
  if (before.scenes !== after.scenes) return 'Updated the film strip';
  if (before.collapsedStages !== after.collapsedStages) return 'Folded a stage';
  return 'Edited the pipeline';
}

function headLabel(): string | null {
  if (undoGroup) return describeEdit(undoGroup.baseline, usePipelineStore.getState());
  return undoLabels[undoLabels.length - 1] ?? null;
}

function undoEntryOf(state: PipelineState): UndoEntry {
  return {
    nodes: state.nodes,
    edges: state.edges,
    scenes: state.scenes,
    collapsedStages: state.collapsedStages,
    selectedId: state.selectedId,
    lastCookedNodeId: state.lastCookedNodeId,
  };
}

function nodeEdited(before: PipelineNode, after: PipelineNode): boolean {
  return before.type !== after.type
    || before.stage !== after.stage
    || before.title !== after.title
    || before.slot !== after.slot
    || before.x !== after.x
    || before.y !== after.y
    || before.inLane !== after.inLane
    || before.params !== after.params
    || before.variants !== after.variants
    || before.activeVariantId !== after.activeVariantId
    || before.collapsed !== after.collapsed
    || before.deckOpen !== after.deckOpen
    || before.clusterFrame?.x !== after.clusterFrame?.x
    || before.clusterFrame?.y !== after.clusterFrame?.y
    || before.clusterFrame?.w !== after.clusterFrame?.w
    || before.clusterFrame?.h !== after.clusterFrame?.h
    || before.clusterCollapsed !== after.clusterCollapsed;
}

function graphEdited(prev: PipelineState, state: PipelineState): boolean {
  if (prev.edges !== state.edges || prev.scenes !== state.scenes || prev.collapsedStages !== state.collapsedStages) return true;
  if (prev.nodes === state.nodes) return false;
  if (prev.nodes.length !== state.nodes.length) return true;
  for (let i = 0; i < state.nodes.length; i += 1) {
    if (prev.nodes[i] !== state.nodes[i] && nodeEdited(prev.nodes[i], state.nodes[i])) return true;
  }
  return false;
}

function publishUndo() {
  const depth = undoStack.length + (undoGroup ? 1 : 0);
  const label = headLabel();
  const state = usePipelineStore.getState();
  if (state.undoDepth !== depth || state.undoLabel !== label) {
    usePipelineStore.setState({ undoDepth: depth, undoLabel: label });
  }
}

function commitUndoGroup() {
  if (!undoGroup) return;
  const label = describeEdit(undoGroup.baseline, usePipelineStore.getState());
  undoStack.push(undoGroup.baseline);
  undoLabels.push(label);
  if (undoStack.length > UNDO_LIMIT) {
    undoStack.shift();
    undoLabels.shift();
  }
  undoGroup = null;
  useLogStore.getState().log('workshop_edit', label, undefined, true);
  publishUndo();
}

function rememberUndo(prev: PipelineState) {
  if (!undoGroup) undoGroup = { baseline: undoEntryOf(prev), timer: setTimeout(commitUndoGroup, UNDO_GROUP_MS) };
  else {
    clearTimeout(undoGroup.timer);
    undoGroup.timer = setTimeout(commitUndoGroup, UNDO_GROUP_MS);
  }
  publishUndo();
}

function applyUndo(entry: UndoEntry) {
  restoringUndo = true;
  usePipelineStore.setState({
    ...entry,
    pendingEdge: null,
  });
  restoringUndo = false;
  publishUndo();
}

function noteReturned() {
  useLogStore.getState().markLatestReturned();
}

function resetUndo() {
  if (undoGroup) clearTimeout(undoGroup.timer);
  undoGroup = null;
  undoStack.length = 0;
  undoLabels.length = 0;
  publishUndo();
}

export const usePipelineStore = create<PipelineState>()(
    (set, get) => ({
      nodes: [],
      edges: [],
      viewport: { x: 60, y: 40, zoom: 0.85 },
      selectedId: null,
      pendingEdge: null,
      dragOverStage: null,
      dragInsertIndex: null,
      draggingId: null,
      isRunning: false,
      runningNodeIds: [],
      lastCookedNodeId: null,
      undoDepth: 0,
      undoLabel: null,
      collapsedStages: [],
      openStages: [],
      currentProjectId: null,
      currentProjectName: '',
      isLoadingProject: false,

      loadForProject: async (projectId, projectName) => {
        if (!projectId || get().currentProjectId === projectId) return;
        // Reset first so a project switch never bleeds the previous project's
        // nodes/scenes into the new one while the async load is in flight.
        set({
          nodes: [], edges: [], viewport: EMPTY_VIEWPORT, collapsedStages: [], openStages: [],
          dragOverStage: null, dragInsertIndex: null, draggingId: null,
          scenes: [], paramTemplates: [], selectedId: null, lastCookedNodeId: null,
          currentProjectId: projectId, currentProjectName: projectName ?? '',
          isLoadingProject: true,
        });
        try {
          if (typeof window !== 'undefined') {
            const raw = localStorage.getItem(pipelineStorageKey(projectId));
            if (raw) {
              const data = JSON.parse(raw);
              set({
                nodes: (data.nodes ?? []).map(normalizeLoadedNode), edges: data.edges ?? [],
                viewport: data.viewport ?? EMPTY_VIEWPORT,
                collapsedStages: data.collapsedStages ?? [],
                openStages: data.openStages ?? [],
                scenes: data.scenes ?? [], paramTemplates: data.paramTemplates ?? [],
                lastCookedNodeId: data.lastCookedNodeId ?? null,
                isLoadingProject: false,
              });
              return;
            }
          }
          const res = await fetch(`/api/workspace/load?projectId=${encodeURIComponent(projectId)}`);
          if (res.ok) {
            const data = await res.json();
            const p = data?.pipeline;
            if (p && get().currentProjectId === projectId) {
              set({
                nodes: (p.nodes ?? []).map(normalizeLoadedNode), edges: p.edges ?? [],
                viewport: p.viewport ?? EMPTY_VIEWPORT,
                collapsedStages: p.collapsedStages ?? [],
                openStages: p.openStages ?? [],
                scenes: p.scenes ?? [], paramTemplates: p.paramTemplates ?? [],
                lastCookedNodeId: p.lastCookedNodeId ?? null,
              });
            }
          }
        } catch {
          // Non-fatal — project simply opens with an empty Workshop.
        } finally {
          if (get().currentProjectId === projectId) set({ isLoadingProject: false });
        }
      },

      saveForProject: (projectId, projectName) => {
        if (!projectId || typeof window === 'undefined') return;
        // Guard against writing another project's in-memory state under this
        // key if loadForProject(projectId) hasn't completed/run yet.
        if (get().currentProjectId !== projectId) return;
        // Flush immediately (unmount/beforeunload path) — cancel any pending
        // debounced write since this supersedes it.
        if (_pipelinePersistTimer) { clearTimeout(_pipelinePersistTimer); _pipelinePersistTimer = null; }
        persistNow(projectId, projectName, buildPersistPayload(get()));
      },

      listSnapshots: async (projectId) => {
        try {
          const res = await fetch(`/api/workspace/pipelines?projectId=${encodeURIComponent(projectId)}`);
          if (!res.ok) return [];
          const data = await res.json();
          return (data.snapshots ?? []) as PipelineSnapshotMeta[];
        } catch {
          return [];
        }
      },

      saveSnapshot: async (projectId, projectName, name) => {
        const s = get();
        const payload = {
          projectId, projectName, name,
          nodes: s.nodes.map((n) => ({ ...n, status: 'idle' as const })),
          edges: s.edges, viewport: s.viewport, collapsedStages: s.collapsedStages,
          openStages: s.openStages,
          scenes: s.scenes, paramTemplates: s.paramTemplates,
        };
        await fetch('/api/workspace/pipelines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
      },

      loadSnapshot: async (projectId, snapshotId) => {
        try {
          const res = await fetch(`/api/workspace/pipelines?projectId=${encodeURIComponent(projectId)}&snapshotId=${encodeURIComponent(snapshotId)}`);
          if (!res.ok) return;
          const data = await res.json();
          set({
            nodes: data.nodes ?? [], edges: data.edges ?? [],
            viewport: data.viewport ?? get().viewport,
            collapsedStages: data.collapsedStages ?? [],
            openStages: data.openStages ?? [],
            scenes: data.scenes ?? [], paramTemplates: data.paramTemplates ?? [],
            selectedId: null,
          });
        } catch {
          // Non-fatal — the current draft is left untouched on failure.
        }
      },

      renameSnapshot: async (projectId, snapshotId, name) => {
        await fetch('/api/workspace/pipelines', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, snapshotId, name }),
        }).catch(() => {});
      },

      deleteSnapshot: async (projectId, snapshotId) => {
        await fetch(`/api/workspace/pipelines?projectId=${encodeURIComponent(projectId)}&snapshotId=${encodeURIComponent(snapshotId)}`, {
          method: 'DELETE',
        }).catch(() => {});
      },

      addNode: (type) => {
        const def = PIPELINE_NODE_DEFS[type];
        if (!def) return null;
        const siblings = get().nodes.filter((n) => n.stage === def.stage);
        const node: PipelineNode = {
          id: uuidv4(),
          type,
          stage: def.stage,
          title: def.title,
          slot: siblings.length,
          params: defaultParams(def),
          status: 'idle',
          variants: [],
        };
        set((s) => ({ nodes: [...s.nodes, node], selectedId: node.id }));
        return node;
      },

      removeNode: (id) => {
        get().removeNodes([id]);
      },

      removeNodes: (ids) => {
        const drop = new Set(ids);
        if (drop.size === 0) return;
        set((s) => {
          const kept = s.nodes.filter((node) => !drop.has(node.id));
          const laneNodes = new Map<string, typeof kept>();
          for (const node of kept) {
            if (node.inLane === false) continue;
            const list = laneNodes.get(node.stage) ?? [];
            list.push(node);
            laneNodes.set(node.stage, list);
          }
          const slotOf = new Map<string, number>();
          for (const list of laneNodes.values()) {
            list.sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id));
            list.forEach((node, index) => slotOf.set(node.id, index));
          }
          return {
            nodes: kept.map((node) => {
              const slot = slotOf.get(node.id);
              return slot === undefined || slot === node.slot ? node : { ...node, slot };
            }),
            edges: s.edges.filter((edge) => !drop.has(edge.from) && !drop.has(edge.to)),
            selectedId: s.selectedId && drop.has(s.selectedId) ? null : s.selectedId,
            lastCookedNodeId: s.lastCookedNodeId && drop.has(s.lastCookedNodeId) ? null : s.lastCookedNodeId,
          };
        });
      },

      renameNode: (id, title) =>
        set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, title } : n)) })),

      setParam: (id, key, value) =>
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === id ? { ...n, params: { ...n.params, [key]: value } } : n
          ),
        })),

      moveNodeToSlot: (id, stage, slot) => {
        set((s) => {
          const node = s.nodes.find((n) => n.id === id);
          if (!node) return s;
          const rest = s.nodes.filter((n) => n.id !== id);
          const target = rest
            .filter((n) => n.stage === stage && n.inLane !== false)
            .sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id));
          const index = Math.max(0, Math.min(slot, target.length));
          const ordered = [
            ...target.slice(0, index),
            { ...node, stage, inLane: true as const, x: undefined, y: undefined },
            ...target.slice(index),
          ];
          const slotOf = new Map(ordered.map((n, i) => [n.id, i]));
          const source = node.stage === stage
            ? []
            : rest
              .filter((n) => n.stage === node.stage && n.inLane !== false)
              .sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id));
          const sourceSlot = new Map(source.map((n, i) => [n.id, i]));
          const nodes = rest.map((n) => {
            if (slotOf.has(n.id)) {
              const nextSlot = slotOf.get(n.id)!;
              return { ...n, stage, slot: nextSlot, inLane: true as const, x: undefined, y: undefined };
            }
            if (sourceSlot.has(n.id)) {
              return { ...n, slot: sourceSlot.get(n.id)!, x: undefined, y: undefined };
            }
            return n;
          });
          return { nodes: [...nodes, { ...node, stage, slot: slotOf.get(id)!, inLane: true, x: undefined, y: undefined }] };
        });
      },

      setNodePosition: (id, x, y) =>
        set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) })),

      placeFree: (id, x, y) =>
        set((s) => ({
          nodes: compactInLane(s.nodes.map((n) => {
            if (n.id !== id) return n;
            const home = n.type === 'image-import' ? PIPELINE_NODE_DEFS[n.type]?.stage ?? n.stage : n.stage;
            return { ...n, x, y, inLane: false, stage: home };
          })),
        })),

      setDragTarget: (stage, index) => {
        const current = get();
        if (current.dragOverStage === stage && current.dragInsertIndex === index) return;
        set({ dragOverStage: stage, dragInsertIndex: index });
      },

      setDraggingNode: (id) => {
        const current = get();
        if (current.draggingId === id) return;
        if (!id) {
          set({ draggingId: null });
          return;
        }
        set({ draggingId: id, nodes: compactInLane(current.nodes, id) });
      },

      joinLane: (id, stage, index) => {
        const members = get().nodes.filter((n) => n.stage === stage && n.id !== id && n.inLane !== false);
        const at = index == null ? members.length : Math.max(0, Math.min(index, members.length));
        get().moveNodeToSlot(id, stage, at);
        if (get().collapsedStages.includes(stage)) {
          set({ collapsedStages: get().collapsedStages.filter((item) => item !== stage) });
        }
      },

      compactLanes: () => {
        const nodes = compactInLane(get().nodes);
        if (nodes !== get().nodes) set({ nodes });
      },

      releaseSparseMoodboard: () => {
        if (get().openStages.includes('concept')) return;
        const nodes = get().nodes;
        if (showStageLane(nodes, 'concept')) return;
        const stranded = nodes.filter((n) => n.stage === 'concept' && n.inLane !== false && n.type === 'image-import');
        if (stranded.length === 0) return;
        set({
          nodes: compactInLane(nodes.map((n) => {
            if (!stranded.some((item) => item.id === n.id)) return n;
            const at = nodePosition(n);
            return { ...n, inLane: false, x: at.x, y: at.y, stage: 'visual' as const };
          })),
        });
      },

      resetNodePosition: (id) =>
        set((s) => ({
          nodes: s.nodes.map((n) => (n.id === id ? { ...n, x: undefined, y: undefined } : n)),
        })),

      toggleDeck: (id) =>
        set((s) => ({
          nodes: s.nodes.map((n) => (n.id === id ? { ...n, deckOpen: !n.deckOpen } : n)),
        })),

      setCollapsed: (id, collapsed) =>
        set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, collapsed } : n)) })),

      addVariant: (nodeId, variant) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        const nextVersion = 1 + Math.max(0, ...(node?.variants ?? []).map((v) => v.version ?? 0));
        const now = Date.now();
        const v: NodeVariant = {
          layers: [],
          ...variant,
          id: uuidv4(),
          createdAt: now,
          updatedAt: now,
          version: variant.version ?? nextVersion,
        };
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === nodeId
              ? { ...n, variants: [v, ...n.variants].slice(0, 24), activeVariantId: v.id }
              : n
          ),
        }));
        return v;
      },

      updateVariant: (nodeId, variantId, patch) =>
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  variants: n.variants.map((v) =>
                    v.id === variantId ? { ...v, ...patch, updatedAt: Date.now() } : v
                  ),
                }
              : n
          ),
        })),

      selectVariant: (nodeId, variantId) =>
        set((s) => ({
          nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, activeVariantId: variantId } : n)),
        })),

      removeVariant: (nodeId, variantId) =>
        set((s) => ({
          nodes: s.nodes.map((n) => {
            if (n.id !== nodeId) return n;
            const variants = n.variants.filter((v) => v.id !== variantId);
            return {
              ...n,
              variants,
              activeVariantId:
                n.activeVariantId === variantId ? variants[0]?.id : n.activeVariantId,
            };
          }),
        })),

      pinVariant: (nodeId, variantId) =>
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  variants: n.variants.map((v) =>
                    v.id === variantId ? { ...v, pinned: !v.pinned } : v
                  ),
                }
              : n
          ),
        })),

      addLayer: (nodeId, variantId, kind, partial) => {
        const layer = createLayer(kind, partial);
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  variants: n.variants.map((v) =>
                    v.id === variantId
                      ? { ...v, layers: [...(v.layers ?? []), layer], updatedAt: Date.now() }
                      : v
                  ),
                }
              : n
          ),
        }));
        return layer;
      },

      updateLayer: (nodeId, variantId, layerId, patch) =>
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  variants: n.variants.map((v) =>
                    v.id === variantId
                      ? {
                          ...v,
                          updatedAt: Date.now(),
                          layers: (v.layers ?? []).map((l) =>
                            l.id === layerId ? { ...l, ...patch, updatedAt: Date.now() } : l
                          ),
                        }
                      : v
                  ),
                }
              : n
          ),
        })),

      removeLayer: (nodeId, variantId, layerId) =>
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  variants: n.variants.map((v) =>
                    v.id === variantId
                      ? { ...v, updatedAt: Date.now(), layers: (v.layers ?? []).filter((l) => l.id !== layerId) }
                      : v
                  ),
                }
              : n
          ),
        })),

      duplicateLayer: (nodeId, variantId, layerId) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        const variant = node?.variants.find((v) => v.id === variantId);
        const src = variant?.layers?.find((l) => l.id === layerId);
        if (!src) return;
        const copy = createLayer(src.kind, {
          ...src,
          id: undefined as unknown as string,
          name: `${src.name} copy`,
          x: Math.min(0.95, src.x + 0.03),
          y: Math.min(0.95, src.y + 0.03),
        });
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  variants: n.variants.map((v) =>
                    v.id === variantId
                      ? { ...v, updatedAt: Date.now(), layers: [...(v.layers ?? []), copy] }
                      : v
                  ),
                }
              : n
          ),
        }));
      },

      reorderLayer: (nodeId, variantId, layerId, dir) =>
        set((s) => ({
          nodes: s.nodes.map((n) => {
            if (n.id !== nodeId) return n;
            return {
              ...n,
              variants: n.variants.map((v) => {
                if (v.id !== variantId || !v.layers) return v;
                const idx = v.layers.findIndex((l) => l.id === layerId);
                const target = idx + dir;
                if (idx < 0 || target < 0 || target >= v.layers.length) return v;
                const layers = [...v.layers];
                [layers[idx], layers[target]] = [layers[target], layers[idx]];
                return { ...v, layers, updatedAt: Date.now() };
              }),
            };
          }),
        })),

      flattenVariant: async (nodeId, variantId) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        const variant = node?.variants.find((v) => v.id === variantId);
        if (!node || !variant?.image) return;
        const flat = await compositeVariant(variant);
        get().addVariant(nodeId, {
          label: `${variant.label} · flattened`,
          image: flat,
          text: variant.text,
          seed: variant.seed,
          paramsSnapshot: variant.paramsSnapshot,
          parentVariantId: variant.id,
          meta: { ...variant.meta, flattenedFrom: variant.id },
          layers: [],
        });
      },

      transformVariant: async (nodeId, variantId, opts) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        const variant = node?.variants.find((v) => v.id === variantId);
        if (!node || !variant?.image) return;
        const { dataUrl, width, height } = await transformImage(variant.image, opts);
        const fmt = opts.format ?? 'png';
        get().addVariant(nodeId, {
          label: `${variant.label} · ${opts.aspect ?? 'same'} ${width}×${height} ${fmt}`,
          image: dataUrl,
          text: variant.text,
          seed: variant.seed,
          paramsSnapshot: variant.paramsSnapshot,
          parentVariantId: variant.id,
          layers: variant.layers ?? [],
          meta: { ...variant.meta, transform: { ...opts, width, height } },
        });
      },

      duplicateVariant: (nodeId, variantId) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        const variant = node?.variants.find((v) => v.id === variantId);
        if (!node || !variant) return;
        get().addVariant(nodeId, {
          label: `${variant.label} · draft`,
          image: variant.image,
          text: variant.text,
          seed: variant.seed,
          paramsSnapshot: variant.paramsSnapshot,
          parentVariantId: variant.id,
          layers: (variant.layers ?? []).map((l) => ({ ...l })),
          meta: { ...variant.meta, duplicatedFrom: variant.id },
        });
      },

      setVariantText: (nodeId, variantId, text) =>
        get().updateVariant(nodeId, variantId, { text }),

      retouchVariant: async (nodeId, variantId, opLabel, instruction, apiKey) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        const variant = node?.variants.find((v) => v.id === variantId);
        if (!node || !variant?.image) return;
        const mark = (patch: Partial<PipelineNode>) =>
          set((s) => ({ nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)) }));
        mark({ status: 'running', error: undefined });
        set((s) => ({ runningNodeIds: [...s.runningNodeIds, nodeId] }));
        try {
          const directives = layerDirectives(variant);
          const result = await callBanana({
            kind: 'image-edit',
            prompt: `${instruction} ${directives}`.trim(),
            images: [variant.image],
            apiKey,
          });
          get().addVariant(nodeId, {
            label: `${variant.label} · ${opLabel}`,
            image: result.dataUrl,
            text: result.text,
            seed: variant.seed,
            parentVariantId: variant.id,
            paramsSnapshot: { __prompt: instruction },
            layers: [],
            meta: { ...variant.meta, model: result.model, retouch: opLabel },
          });
          mark({ status: 'done' });
          if (result.dataUrl) set({ lastCookedNodeId: nodeId });
        } catch (err) {
          mark({ status: 'error', error: err instanceof Error ? err.message : String(err) });
        } finally {
          set((s) => ({ runningNodeIds: s.runningNodeIds.filter((r) => r !== nodeId) }));
        }
      },

      startEdge: (nodeId, portId, portType, side) => {
        if (side === 'out') {
          set({ pendingEdge: { from: nodeId, fromPort: portId, portType, origin: 'output' } });
          return;
        }
        set({ pendingEdge: { from: '', fromPort: '', portType, origin: 'input', to: nodeId, toPort: portId } });
      },

      completeEdge: (nodeId, portId, portType, side) => {
        const { pendingEdge, edges, nodes } = get();
        if (!pendingEdge) return false;
        let fromId = '';
        let fromPort = '';
        let toId = '';
        let toPort = '';
        let edgeType = portType;
        if (pendingEdge.origin === 'output') {
          if (side !== 'in') {
            set({ pendingEdge: null });
            return false;
          }
          fromId = pendingEdge.from;
          fromPort = pendingEdge.fromPort;
          toId = nodeId;
          toPort = portId;
          edgeType = pendingEdge.portType;
          if (!portsCompatible(edgeType, portType)) {
            set({ pendingEdge: null });
            return false;
          }
        } else {
          if (side !== 'out' || !pendingEdge.to || !pendingEdge.toPort) {
            set({ pendingEdge: null });
            return false;
          }
          fromId = nodeId;
          fromPort = portId;
          toId = pendingEdge.to;
          toPort = pendingEdge.toPort;
          edgeType = portType;
          if (!portsCompatible(portType, pendingEdge.portType)) {
            set({ pendingEdge: null });
            return false;
          }
        }
        if (!fromId || fromId === toId) {
          set({ pendingEdge: null });
          return false;
        }
        const target = PIPELINE_NODE_DEFS[nodes.find((node) => node.id === toId)?.type ?? ''];
        const input = target?.inputs.find((port) => port.id === toPort);
        const filtered = input?.multi
          ? edges
          : edges.filter((edge) => !(edge.to === toId && edge.toPort === toPort));
        if (filtered.some((edge) => edge.from === fromId && edge.fromPort === fromPort && edge.to === toId && edge.toPort === toPort)) {
          set({ pendingEdge: null });
          return true;
        }
        const edge: PipelineEdge = {
          id: uuidv4(),
          from: fromId,
          fromPort,
          to: toId,
          toPort,
          type: edgeType as PipelineEdge['type'],
        };
        set({ edges: [...filtered, edge], pendingEdge: null });
        return true;
      },

      spawnLinkedNode: ({ type, newPortId, sourceId, sourcePortId, sourceSide }) => {
        const def = PIPELINE_NODE_DEFS[type];
        const state = get();
        const source = state.nodes.find((node) => node.id === sourceId);
        const sourceDef = source ? PIPELINE_NODE_DEFS[source.type] : undefined;
        const newPort = (sourceSide === 'out' ? def?.inputs : def?.outputs)?.find((port) => port.id === newPortId);
        const sourcePort = (sourceSide === 'out' ? sourceDef?.outputs : sourceDef?.inputs)?.find((port) => port.id === sourcePortId);
        if (!def || !source || !newPort || !sourcePort) return null;
        const compatible = sourceSide === 'out'
          ? portsCompatible(sourcePort.type, newPort.type)
          : portsCompatible(newPort.type, sourcePort.type);
        if (!compatible) return null;

        const id = uuidv4();
        const node: PipelineNode = {
          id,
          type,
          stage: def.stage,
          title: def.title,
          slot: state.nodes.filter((item) => item.stage === def.stage && item.inLane !== false).length,
          params: defaultParams(def),
          status: 'idle',
          variants: [],
        };
        const fromId = sourceSide === 'out' ? source.id : id;
        const fromPort = sourceSide === 'out' ? sourcePort.id : newPort.id;
        const toId = sourceSide === 'out' ? id : source.id;
        const toPort = sourceSide === 'out' ? newPort.id : sourcePort.id;
        const edge: PipelineEdge = {
          id: uuidv4(),
          from: fromId,
          fromPort,
          to: toId,
          toPort,
          type: (sourceSide === 'out' ? sourcePort.type : newPort.type) as PipelineEdge['type'],
        };

        let nodes = state.nodes;
        let openStages = state.openStages;
        if (source.clusterId) {
          const frame = source.clusterFrame
            ?? nodes.find((item) => item.clusterId === source.clusterId)?.clusterFrame;
          node.inLane = false;
          node.clusterId = source.clusterId;
          node.clusterTitle = source.clusterTitle;
          node.clusterIcon = source.clusterIcon;
          node.clusterCollapsed = false;
          const members = nodes
            .filter((item) => item.clusterId === source.clusterId)
            .map((item) => ({ ...item, clusterCollapsed: false as const }));
          const ids = [...members.map((item) => item.id), id];
          const internal = [...state.edges.filter((item) => ids.includes(item.from) && ids.includes(item.to)), edge];
          const packed = packCluster(ids, internal);
          const origin = frame
            ? { x: frame.x, y: frame.y }
            : {
                x: nodePosition(source).x - CLUSTER_PAD_X,
                y: nodePosition(source).y - CLUSTER_PAD_TOP,
              };
          const plate = { x: origin.x, y: origin.y, w: packed.width, h: packed.height };
          const placed = placeCluster(ids, internal, plate);
          const at = placed.get(id);
          if (at) {
            node.x = at.x;
            node.y = at.y;
          }
          node.clusterFrame = plate;
          nodes = [
            ...nodes.filter((item) => item.clusterId !== source.clusterId),
            ...members.map((member) => {
              const pos = placed.get(member.id);
              return pos
                ? { ...member, x: pos.x, y: pos.y, inLane: false as const, clusterFrame: plate, clusterCollapsed: false }
                : { ...member, clusterCollapsed: false };
            }),
            node,
          ];
        } else if (source.inLane !== false && def.stage === source.stage) {
          const lane = nodes
            .filter((item) => item.stage === source.stage && item.inLane !== false)
            .sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id));
          const sourceIndex = Math.max(0, lane.findIndex((item) => item.id === source.id));
          const insert = sourceSide === 'out' ? sourceIndex + 1 : sourceIndex;
          const ordered = [...lane.slice(0, insert), node, ...lane.slice(insert)];
          const slotOf = new Map(ordered.map((item, index) => [item.id, index]));
          node.inLane = true;
          node.slot = slotOf.get(id) ?? 0;
          node.x = undefined;
          node.y = undefined;
          nodes = [
            ...nodes.map((item) => (
              slotOf.has(item.id)
                ? { ...item, slot: slotOf.get(item.id)!, inLane: true as const, x: undefined, y: undefined }
                : item
            )),
            node,
          ];
        } else if (source.inLane !== false) {
          node.inLane = true;
          node.stage = def.stage;
          node.slot = nodes.filter((item) => item.stage === def.stage && item.inLane !== false).length;
          if (!openStages.includes(def.stage)) openStages = [...openStages, def.stage];
          nodes = [...nodes, node];
        } else {
          const at = nodePosition(source);
          let x = sourceSide === 'out' ? at.x + NODE_W + 72 : at.x - (NODE_W + 72);
          let y = at.y;
          const occupied = nodes.map((item) => {
            const pos = nodePosition(item);
            return { x: pos.x, y: pos.y, w: NODE_W, h: NODE_H };
          });
          for (let step = 0; step < 12 && occupied.some((box) => rectsOverlap({ x, y, w: NODE_W, h: NODE_H }, box)); step += 1) {
            y += NODE_H + 24;
          }
          node.inLane = false;
          node.x = x;
          node.y = y;
          nodes = [...nodes, node];
        }

        const target = PIPELINE_NODE_DEFS[nodes.find((item) => item.id === toId)?.type ?? ''];
        const input = target?.inputs.find((port) => port.id === toPort);
        const edges = input?.multi
          ? state.edges
          : state.edges.filter((item) => !(item.to === toId && item.toPort === toPort));
        set({
          nodes,
          edges: [...edges, edge],
          openStages,
          selectedId: id,
          pendingEdge: null,
          collapsedStages: state.collapsedStages.filter((stage) => stage !== node.stage),
        });
        return id;
      },

      cancelEdge: () => set({ pendingEdge: null }),

      removeEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

      select: (id) => set({ selectedId: id }),
      setViewport: (viewport) => set({ viewport }),

      editorNodeId: null,
      openEditor: (nodeId) => set({ editorNodeId: nodeId }),
      closeEditor: () => set({ editorNodeId: null }),

      scenes: [],
      stripOpen: true,
      toggleStrip: () => set((s) => ({ stripOpen: !s.stripOpen })),

      addSceneFromNode: (nodeId) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        const variant = node ? activeVariant(node) : undefined;
        if (!node || !variant?.image) return;
        const scene: SceneRef = {
          id: uuidv4(),
          nodeId,
          variantId: variant.id,
          label: `${node.title} v${variant.version ?? 1}`,
          duration: 3,
          transition: 'cut',
        };
        set((s) => ({ scenes: [...s.scenes, scene], stripOpen: true }));
      },

      removeScene: (sceneId) =>
        set((s) => ({ scenes: s.scenes.filter((sc) => sc.id !== sceneId) })),

      moveScene: (sceneId, dir) =>
        set((s) => {
          const idx = s.scenes.findIndex((sc) => sc.id === sceneId);
          const target = idx + dir;
          if (idx < 0 || target < 0 || target >= s.scenes.length) return s;
          const scenes = [...s.scenes];
          [scenes[idx], scenes[target]] = [scenes[target], scenes[idx]];
          return { scenes };
        }),

      updateScene: (sceneId, patch) =>
        set((s) => ({
          scenes: s.scenes.map((sc) => (sc.id === sceneId ? { ...sc, ...patch } : sc)),
        })),

      paramTemplates: [],

      saveTemplate: (nodeId, name) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        if (!node || !name.trim()) return;
        const tpl: ParamTemplate = {
          name: name.trim(),
          nodeType: node.type,
          params: { ...node.params },
          createdAt: Date.now(),
        };
        set((s) => ({
          paramTemplates: [
            ...s.paramTemplates.filter((t) => !(t.nodeType === tpl.nodeType && t.name === tpl.name)),
            tpl,
          ],
        }));
      },

      applyTemplate: (nodeId, templateName) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        const tpl = get().paramTemplates.find(
          (t) => t.nodeType === node?.type && t.name === templateName
        );
        if (!node || !tpl) return;
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === nodeId ? { ...n, params: { ...n.params, ...tpl.params } } : n
          ),
        }));
      },

      deleteTemplate: (nodeType, templateName) =>
        set((s) => ({
          paramTemplates: s.paramTemplates.filter(
            (t) => !(t.nodeType === nodeType && t.name === templateName)
          ),
        })),

      groups: () => {
        const { nodes, collapsedStages, openStages, draggingId } = get();
        const dragging = nodes.find((node) => node.id === draggingId);
        const sticky = dragging && dragging.inLane !== false ? dragging.stage : null;
        const resting = draggingId ? nodes.filter((node) => node.id !== draggingId) : nodes;
        return STAGE_ORDER.filter((stage) => (
          openStages.includes(stage) || stage === sticky || showStageLane(resting, stage)
        )).map((stage) => ({
          id: `group-${stage}`,
          stage,
          nodeIds: resting
            .filter((n) => n.stage === stage && n.inLane !== false)
            .sort((a, b) => a.slot - b.slot)
            .map((n) => n.id),
          collapsed: collapsedStages.includes(stage),
        }));
      },

      openStage: (stage) =>
        set((s) => (s.openStages.includes(stage) ? s : { openStages: [...s.openStages, stage] })),

      closeStage: (stage) =>
        set((s) => ({ openStages: s.openStages.filter((item) => item !== stage) })),

      toggleGroupCollapsed: (stage) =>
        set((s) => ({
          collapsedStages: s.collapsedStages.includes(stage)
            ? s.collapsedStages.filter((st) => st !== stage)
            : [...s.collapsedStages, stage],
        })),

      runNode: async (id, apiKey) => {
        const state = get();
        const node = state.nodes.find((n) => n.id === id);
        if (!node) return;
        const def = PIPELINE_NODE_DEFS[node.type];
        if (!def) return;

        const mark = (patch: Partial<PipelineNode>) =>
          set((s) => ({
            nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
          }));

        if (node.type === 'image-import') {
          if (node.status === 'done') mark({ status: 'idle', error: undefined });
          return;
        }

        if (def.execution === 'import' || def.execution === 'manual' || def.execution === 'compose' || def.execution === 'local') {
          // ── Sequence: assemble the Edit Decision List from the film strip ──
          if (node.type === 'sequence') {
            const scenes = get().scenes;
            const inEdges = state.edges.filter((e) => e.to === id);
            const audioIn = inEdges.some((e) => e.toPort === 'mix');
            if (scenes.length === 0) {
              mark({ status: 'error', error: 'Film strip is empty — add pictures via a node\'s Info tab → "Add to film".' });
              return;
            }
            let clock = 0;
            const rows = scenes.map((sc, i) => {
              const inTc = clock.toFixed(1);
              clock += sc.duration;
              return `${String(i + 1).padStart(3, '0')}  ${inTc.padStart(6)}s → ${clock.toFixed(1).padStart(6)}s  ${sc.label}  [${sc.transition} → next]${sc.note ? `  · ${sc.note}` : ''}`;
            });
            const edl = [
              `EDL — ${scenes.length} scenes · ${clock.toFixed(1)}s total · audio: ${audioIn ? 'mixed track attached' : 'none'}`,
              `pacing: ${node.params.pacingCurve ?? 'even'} · default transition: ${node.params.defaultTransition ?? 'cut'}`,
              '─'.repeat(56),
              ...rows,
            ].join('\n');
            get().addVariant(id, {
              label: `Cut · ${scenes.length} scenes · ${clock.toFixed(1)}s`,
              text: edl,
              paramsSnapshot: { ...node.params },
              meta: { edl: scenes.map((sc) => ({ nodeId: sc.nodeId, variantId: sc.variantId, duration: sc.duration, transition: sc.transition })) },
            });
            mark({ status: 'done', error: undefined });
            return;
          }

          // ── Audio mix: build the mix sheet from upstream stems ──
          if (node.type === 'audio-mix') {
            const inEdges = state.edges.filter((e) => e.to === id);
            const stems: Record<string, string[]> = { dialogue: [], music: [], sfx: [] };
            for (const e of inEdges) {
              const src = state.nodes.find((n) => n.id === e.from);
              const v = src ? activeVariant(src) : undefined;
              if (v?.text && stems[e.toPort]) stems[e.toPort].push(`${src!.title}: ${v.text.split('\n')[0].slice(0, 80)}`);
            }
            const sheet = [
              `MIX SHEET — target ${node.params.loudnessTarget ?? '-14'} LUFS · limiter: ${node.params.limiter ? 'on' : 'off'}`,
              `dialogue ${node.params.dialogueLevel ?? 0} dB (${stems.dialogue.length} stem${stems.dialogue.length === 1 ? '' : 's'})`,
              ...stems.dialogue.map((s) => `  · ${s}`),
              `music ${node.params.musicLevel ?? -12} dB, auto-duck ${node.params.ducking ? `${node.params.duckAmount ?? -9} dB under dialogue` : 'off'} (${stems.music.length})`,
              ...stems.music.map((s) => `  · ${s}`),
              `sfx ${node.params.sfxLevel ?? -8} dB (${stems.sfx.length})`,
              ...stems.sfx.map((s) => `  · ${s}`),
            ].join('\n');
            get().addVariant(id, {
              label: 'Mix sheet',
              text: sheet,
              paramsSnapshot: { ...node.params },
            });
            mark({ status: 'done', error: undefined });
            return;
          }

          // Non-model nodes: snapshot params as a "variant" so downstream can read them
          const summary = def.params
            .filter((p) => node.params[p.id] !== undefined && node.params[p.id] !== '')
            .map((p) => `${p.label}: ${Array.isArray(node.params[p.id]) ? (node.params[p.id] as unknown[]).join(', ') : String(node.params[p.id])}`)
            .join('\n');
          get().addVariant(id, {
            label: `${def.title} spec`,
            text: summary,
            paramsSnapshot: { ...node.params },
            image: typeof node.params.file === 'string' ? (node.params.file as string) : undefined,
          });
          mark({ status: 'done', error: undefined });
          return;
        }

        mark({ status: 'running', error: undefined });
        set((s) => ({ runningNodeIds: [...s.runningNodeIds, id] }));

        try {
          // Gather upstream context
          const inEdges = state.edges.filter((e) => e.to === id);
          const upstreamText: Record<string, string> = {};
          const upstreamImages: string[] = [];
          const maskDirectives: string[] = [];
          for (const e of inEdges) {
            const src = state.nodes.find((n) => n.id === e.from);
            if (!src) continue;
            const v = activeVariant(src);
            if (v?.text) upstreamText[e.toPort] = (upstreamText[e.toPort] ? upstreamText[e.toPort] + '\n' : '') + v.text;
            if (v?.image) upstreamImages.push(v.image);
            // Mask layers drawn on upstream images become region directives
            const directives = layerDirectives(v);
            if (directives) maskDirectives.push(directives);
          }

          let prompt = buildPrompt(def, node.params, upstreamText);
          if (def.execution === 'banana-image-edit' && maskDirectives.length > 0) {
            prompt = `${prompt} ${maskDirectives.join(' ')}`.trim();
          }
          const count = Math.max(1, Math.min(6, Number(node.params.variantCount ?? 1)));
          const kind: BananaRequest['kind'] =
            def.execution === 'banana-text' ? 'text'
            : def.execution === 'banana-image-edit' ? 'image-edit'
            : 'image';

          for (let i = 0; i < count; i++) {
            const seedParam = Number(node.params.seed ?? -1);
            const seed = seedParam >= 0 ? seedParam + i : Math.floor(Math.random() * 1e9);
            const result = await callBanana({
              kind,
              prompt: count > 1 && kind === 'text' ? prompt : prompt,
              images: kind === 'image-edit' ? upstreamImages : upstreamImages.slice(0, 3),
              aspectRatio: typeof node.params.aspectRatio === 'string' ? node.params.aspectRatio : undefined,
              temperature: typeof node.params.temperature === 'number' ? node.params.temperature : undefined,
              apiKey,
            });
            get().addVariant(id, {
              label: `v${node.variants.length + i + 1}`,
              text: result.text,
              image: result.dataUrl,
              seed,
              paramsSnapshot: { ...node.params, __prompt: prompt },
              meta: { model: result.model },
            });
            if (result.dataUrl) set({ lastCookedNodeId: id });
          }
          mark({ status: 'done' });
        } catch (err) {
          mark({ status: 'error', error: err instanceof Error ? err.message : String(err) });
        } finally {
          set((s) => ({ runningNodeIds: s.runningNodeIds.filter((r) => r !== id) }));
        }
      },

      runAll: async (apiKey) => {
        if (get().isRunning) return;
        set({ isRunning: true });
        try {
          // Topological order over edges; ties within a layer broken by
          // stage order then slot. Each whole layer of independent,
          // simultaneously-ready nodes runs concurrently via Promise.all —
          // previously this awaited one node at a time even when several had
          // no dependency on each other (e.g. seedStarterFlow's parallel
          // moodboard/logline/location branches), needlessly serializing
          // real network round-trips to the generation API.
          const { nodes, edges } = get();
          const indeg: Record<string, number> = {};
          nodes.forEach((n) => (indeg[n.id] = 0));
          edges.forEach((e) => { if (indeg[e.to] !== undefined) indeg[e.to]++; });
          const doneIds = new Set<string>();
          const readyBatch = () =>
            get().nodes
              .filter((n) => !doneIds.has(n.id) && indeg[n.id] === 0)
              .sort((a, b) => STAGES[a.stage].order - STAGES[b.stage].order || a.slot - b.slot);

          let batch = readyBatch();
          while (batch.length > 0 && get().isRunning) {
            batch.forEach((n) => { doneIds.add(n.id); indeg[n.id] = -1; });
            await Promise.all(batch.map((node) => get().runNode(node.id, apiKey)));
            batch.forEach((node) => {
              edges.filter((e) => e.from === node.id).forEach((e) => {
                if (indeg[e.to] > 0) indeg[e.to]--;
              });
            });
            batch = readyBatch();
          }
        } finally {
          set({ isRunning: false });
        }
      },

      stopRun: () => set({ isRunning: false }),

      clearRetiredModelErrors: () => {
        const nodes = get().nodes.map(normalizeLoadedNode);
        if (nodes.some((node, index) => node !== get().nodes[index])) set({ nodes });
      },

      undo: () => {
        if (undoGroup) {
          const baseline = undoGroup.baseline;
          clearTimeout(undoGroup.timer);
          undoGroup = null;
          applyUndo(baseline);
          return;
        }
        const entry = undoStack.pop();
        if (!entry) return;
        undoLabels.pop();
        noteReturned();
        applyUndo(entry);
      },

      seedStarterFlow: (options) => {
        if (get().nodes.length > 0 && !options?.beside) return;
        const add = (type: string) => get().addNode(type);
        const mood = add('moodboard-gen');
        const dna = add('style-dna');
        const log = add('logline-gen');
        const script = add('script-gen');
        const pcraft = add('prompt-craft');
        const sketch = add('sketch-gen');
        const breakdown = add('script-breakdown');
        const char = add('character-profile');
        const sheet = add('character-sheet-gen');
        const loc = add('location-profile');
        const shots = add('shotlist-gen');
        const board = add('storyboard-frame');
        const key = add('keyframe-gen');
        const edit = add('image-edit');
        const anim = add('image-to-video');
        const tts = add('dialogue-tts');
        const music = add('music-gen');
        const mix = add('audio-mix');
        const seq = add('sequence');
        const subs = add('subtitle-gen');
        const fmt = add('format-profile');
        const link = (a: ReturnType<typeof add>, ap: string, b: ReturnType<typeof add>, bp: string, t: string) => {
          if (!a || !b) return;
          set((s) => ({
            edges: [...s.edges, { id: uuidv4(), from: a.id, fromPort: ap, to: b.id, toPort: bp, type: t as PipelineEdge['type'] }],
          }));
        };
        link(mood, 'images', dna, 'refs', 'image-set');
        link(log, 'logline', script, 'logline', 'text');
        link(script, 'script', breakdown, 'script', 'script');
        link(script, 'script', char, 'script', 'script');
        link(char, 'character', sheet, 'character', 'character');
        link(dna, 'style', sheet, 'style', 'style');
        link(script, 'script', shots, 'script', 'script');
        link(shots, 'shotlist', board, 'shotlist', 'shotlist');
        link(char, 'character', board, 'characters', 'character');
        link(loc, 'location', board, 'location', 'location');
        link(dna, 'style', board, 'style', 'style');
        // Prompt Lab path: moodboard + script → crafted prompts
        link(mood, 'images', pcraft, 'moodboard', 'image-set');
        link(script, 'script', pcraft, 'script', 'script');
        // Sketch-guided path: prompts → rough sketch → key visual
        link(pcraft, 'prompts', sketch, 'prompt', 'text');
        link(dna, 'style', sketch, 'style', 'style');
        link(sketch, 'sketch', key, 'sketch', 'image');
        // Alternative direct path: prompts → key visual (skip sketch)
        link(pcraft, 'prompts', key, 'prompt', 'text');
        link(board, 'frame', key, 'board', 'image');
        link(dna, 'style', key, 'style', 'style');
        link(key, 'image', edit, 'image', 'image');
        link(edit, 'image', anim, 'image', 'image');
        link(script, 'script', tts, 'script', 'script');
        link(char, 'character', tts, 'character', 'character');
        link(tts, 'audio', mix, 'dialogue', 'audio');
        link(music, 'audio', mix, 'music', 'audio');
        link(anim, 'video', seq, 'clips', 'video');
        link(mix, 'mix', seq, 'mix', 'audio');
        link(shots, 'shotlist', seq, 'shotlist', 'shotlist');
        link(script, 'script', subs, 'script', 'script');
        link(seq, 'timeline', fmt, 'timeline', 'timeline');
        set({ selectedId: null });
      },

      applyBlueprint: (blueprint, mode, focus) => {
        const compiled = compileBlueprint(blueprint);
        if (compiled.nodes.length === 0) return compiled.warnings;
        const state = get();
        const zoom = state.viewport.zoom || 1;
        const viewW = focus?.viewW ?? 1280;
        const viewH = focus?.viewH ?? 800;
        const center = focus
          ? { x: focus.x, y: focus.y }
          : {
              x: (viewW / 2 - state.viewport.x) / zoom,
              y: (viewH / 2 - state.viewport.y) / zoom,
            };
        const packed = packCluster(
          compiled.nodes.map((node) => node.id),
          compiled.edges,
        );
        const obstacles = mode === 'replace'
          ? []
          : state.nodes.map((node) => {
              const at = nodePosition(node);
              return { x: at.x - 16, y: at.y - 16, w: NODE_W + 32, h: NODE_H + 32 };
            });
        const view = {
          x: -state.viewport.x / zoom,
          y: -state.viewport.y / zoom,
          w: viewW / zoom,
          h: viewH / zoom,
        };
        const origin = findClusterOrigin(center, packed.width, packed.height, obstacles, view);
        const clusterId = uuidv4();
        const clusterFrame = { x: origin.x, y: origin.y, w: packed.width, h: packed.height };
        const placed = compiled.nodes.map((node) => {
          const at = packed.positions.get(node.id) ?? { x: CLUSTER_PAD_X, y: CLUSTER_PAD_TOP };
          return {
            ...node,
            inLane: false as const,
            x: origin.x + at.x,
            y: origin.y + at.y,
            clusterId,
            clusterTitle: blueprint.name,
            clusterIcon: workflowIcon(blueprint.id, blueprint.name),
            clusterFrame,
          };
        });
        const frameRight = origin.x + packed.width;
        const frameBottom = origin.y + packed.height;
        const inside = origin.x >= view.x + 8
          && origin.y >= view.y + 8
          && frameRight <= view.x + view.w - 8
          && frameBottom <= view.y + view.h - 8;
        const viewport = inside
          ? state.viewport
          : {
              ...state.viewport,
              x: viewW / 2 - (origin.x + packed.width / 2) * zoom,
              y: viewH / 2 - (origin.y + packed.height / 2) * zoom,
            };
        if (mode === 'replace') {
          set({
            nodes: placed,
            edges: compiled.edges,
            selectedId: placed[0]?.id ?? null,
            pendingEdge: null,
            lastCookedNodeId: null,
            viewport,
          });
          return compiled.warnings;
        }
        set({
          nodes: [...state.nodes, ...placed],
          edges: [...state.edges, ...compiled.edges],
          selectedId: placed[0]?.id ?? state.selectedId,
          pendingEdge: null,
          viewport,
        });
        return compiled.warnings;
      },

      resizeCluster: (clusterId, frame) => {
        const state = get();
        const members = state.nodes.filter((node) => node.clusterId === clusterId);
        if (members.length === 0) return;
        const ids = members.map((node) => node.id);
        const idSet = new Set(ids);
        const placed = placeCluster(
          ids,
          state.edges.filter((edge) => idSet.has(edge.from) && idSet.has(edge.to)),
          frame,
        );
        set({
          nodes: state.nodes.map((node) => {
            const at = placed.get(node.id);
            if (!at) return node;
            return { ...node, x: at.x, y: at.y, clusterFrame: frame };
          }),
        });
      },

      toggleClusterCollapsed: (clusterId) => {
        const members = get().nodes.filter((node) => node.clusterId === clusterId);
        if (members.length === 0) return;
        const collapsed = !members.some((node) => node.clusterCollapsed);
        set({
          nodes: get().nodes.map((node) => (
            node.clusterId === clusterId ? { ...node, clusterCollapsed: collapsed } : node
          )),
        });
      },

      clearAll: () =>
        set({ nodes: [], edges: [], selectedId: null, pendingEdge: null, isRunning: false, runningNodeIds: [], collapsedStages: [], openStages: [], lastCookedNodeId: null }),
    })
);

// Dirty-check: zustand only creates new array/object references for a field
// when it actually changes, so comparing references (not deep-equality) is a
// cheap, reliable way to know whether anything persisted-relevant moved —
// avoids blindly re-serializing base64-heavy variant images on a timer
// regardless of whether the user did anything (the prior behavior).
usePipelineStore.subscribe((state, prev) => {
  if (
    state.nodes !== prev.nodes ||
    state.edges !== prev.edges ||
    state.viewport !== prev.viewport ||
    state.collapsedStages !== prev.collapsedStages ||
    state.openStages !== prev.openStages ||
    state.scenes !== prev.scenes ||
    state.paramTemplates !== prev.paramTemplates ||
    state.lastCookedNodeId !== prev.lastCookedNodeId
  ) {
    schedulePipelinePersist();
  }
});

usePipelineStore.subscribe((state, prev) => {
  if (restoringUndo) return;
  if (state.currentProjectId !== prev.currentProjectId || state.isLoadingProject) {
    resetUndo();
    return;
  }
  if (prev.isLoadingProject) return;
  if (graphEdited(prev, state)) rememberUndo(prev);
});
