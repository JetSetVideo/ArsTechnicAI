import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  PipelineNode, PipelineEdge, PipelineGroup, PipelineViewport,
  PipelineStageId, NodeVariant, BananaRequest, BananaResponse,
  AssetLayer, LayerKind, SceneRef, ParamTemplate,
} from '@/types/pipeline';
import {
  PIPELINE_NODE_DEFS, STAGES, STAGE_ORDER, defaultParams, buildPrompt, portsCompatible,
} from '@/lib/pipeline/catalog';
import { createLayer, compositeVariant, layerDirectives, transformImage, type ImageTransformOptions } from '@/lib/pipeline/layers';

// ── Auto-layout constants (stage lanes → horizontal; slots → vertical) ──────
export const LANE_WIDTH = 340;
export const LANE_GAP = 90;
export const LANE_HEADER = 76;
export const NODE_W = 292;
export const NODE_H = 200;
export const NODE_GAP = 56;
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

interface PendingEdge {
  from: string;
  fromPort: string;
  portType: string;
}

export interface PipelineSnapshotMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
  sceneCount: number;
}

function pipelineStorageKey(projectId: string): string {
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
  renameNode: (id: string, title: string) => void;
  setParam: (id: string, key: string, value: unknown) => void;
  moveNodeToSlot: (id: string, stage: PipelineStageId, slot: number) => void;
  setNodePosition: (id: string, x: number, y: number) => void;
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
  startEdge: (from: string, fromPort: string, portType: string) => void;
  completeEdge: (to: string, toPort: string, toType: string) => boolean;
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

  // execution
  runNode: (id: string, apiKey: string) => Promise<void>;
  runAll: (apiKey: string) => Promise<void>;
  stopRun: () => void;

  // graph helpers
  seedStarterFlow: () => void;
  clearAll: () => void;
}

/** Active output payload of a node (text or image) for downstream consumption. */
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
    scenes: s.scenes,
    paramTemplates: s.paramTemplates,
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

export const usePipelineStore = create<PipelineState>()(
    (set, get) => ({
      nodes: [],
      edges: [],
      viewport: { x: 60, y: 40, zoom: 0.85 },
      selectedId: null,
      pendingEdge: null,
      isRunning: false,
      runningNodeIds: [],
      collapsedStages: [],
      currentProjectId: null,
      currentProjectName: '',
      isLoadingProject: false,

      loadForProject: async (projectId, projectName) => {
        if (!projectId || get().currentProjectId === projectId) return;
        // Reset first so a project switch never bleeds the previous project's
        // nodes/scenes into the new one while the async load is in flight.
        set({
          nodes: [], edges: [], viewport: EMPTY_VIEWPORT, collapsedStages: [],
          scenes: [], paramTemplates: [], selectedId: null,
          currentProjectId: projectId, currentProjectName: projectName ?? '',
          isLoadingProject: true,
        });
        try {
          if (typeof window !== 'undefined') {
            const raw = localStorage.getItem(pipelineStorageKey(projectId));
            if (raw) {
              const data = JSON.parse(raw);
              set({
                nodes: data.nodes ?? [], edges: data.edges ?? [],
                viewport: data.viewport ?? EMPTY_VIEWPORT,
                collapsedStages: data.collapsedStages ?? [],
                scenes: data.scenes ?? [], paramTemplates: data.paramTemplates ?? [],
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
                nodes: p.nodes ?? [], edges: p.edges ?? [],
                viewport: p.viewport ?? EMPTY_VIEWPORT,
                collapsedStages: p.collapsedStages ?? [],
                scenes: p.scenes ?? [], paramTemplates: p.paramTemplates ?? [],
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
        set((s) => {
          const removed = s.nodes.find((n) => n.id === id);
          const nodes = s.nodes
            .filter((n) => n.id !== id)
            .map((n) =>
              removed && n.stage === removed.stage && n.slot > removed.slot
                ? { ...n, slot: n.slot - 1 }
                : n
            );
          return {
            nodes,
            edges: s.edges.filter((e) => e.from !== id && e.to !== id),
            selectedId: s.selectedId === id ? null : s.selectedId,
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
          const others = s.nodes.filter((n) => n.id !== id);
          // Re-slot source stage
          const reslotted = others.map((n) =>
            n.stage === node.stage && n.slot > node.slot ? { ...n, slot: n.slot - 1 } : n
          );
          const targetCount = reslotted.filter((n) => n.stage === stage).length;
          const clamped = Math.max(0, Math.min(slot, targetCount));
          // Shift target stage down to make room
          const shifted = reslotted.map((n) =>
            n.stage === stage && n.slot >= clamped ? { ...n, slot: n.slot + 1 } : n
          );
          return {
            nodes: [
              ...shifted,
              { ...node, stage, slot: clamped, x: undefined, y: undefined },
            ],
          };
        });
      },

      setNodePosition: (id, x, y) =>
        set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) })),

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
        } catch (err) {
          mark({ status: 'error', error: err instanceof Error ? err.message : String(err) });
        } finally {
          set((s) => ({ runningNodeIds: s.runningNodeIds.filter((r) => r !== nodeId) }));
        }
      },

      startEdge: (from, fromPort, portType) =>
        set({ pendingEdge: { from, fromPort, portType } }),

      completeEdge: (to, toPort, toType) => {
        const { pendingEdge, edges } = get();
        if (!pendingEdge || pendingEdge.from === to) {
          set({ pendingEdge: null });
          return false;
        }
        if (!portsCompatible(pendingEdge.portType, toType)) {
          set({ pendingEdge: null });
          return false;
        }
        const def = PIPELINE_NODE_DEFS[get().nodes.find((n) => n.id === to)?.type ?? ''];
        const port = def?.inputs.find((p) => p.id === toPort);
        // Single-input ports replace the existing edge; multi ports accumulate
        const filtered = port?.multi
          ? edges
          : edges.filter((e) => !(e.to === to && e.toPort === toPort));
        const edge: PipelineEdge = {
          id: uuidv4(),
          from: pendingEdge.from,
          fromPort: pendingEdge.fromPort,
          to,
          toPort,
          type: pendingEdge.portType as PipelineEdge['type'],
        };
        set({ edges: [...filtered, edge], pendingEdge: null });
        return true;
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
        const { nodes, collapsedStages } = get();
        return STAGE_ORDER.filter((stage) => nodes.some((n) => n.stage === stage)).map(
          (stage) => ({
            id: `group-${stage}`,
            stage,
            nodeIds: nodes
              .filter((n) => n.stage === stage)
              .sort((a, b) => a.slot - b.slot)
              .map((n) => n.id),
            collapsed: collapsedStages.includes(stage),
          })
        );
      },

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

      seedStarterFlow: () => {
        if (get().nodes.length > 0) return;
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

      clearAll: () =>
        set({ nodes: [], edges: [], selectedId: null, pendingEdge: null, isRunning: false, runningNodeIds: [], collapsedStages: [] }),
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
    state.scenes !== prev.scenes ||
    state.paramTemplates !== prev.paramTemplates
  ) {
    schedulePipelinePersist();
  }
});
