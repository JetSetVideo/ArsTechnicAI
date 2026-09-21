import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  Asset,
  CanvasAnchor,
  CanvasAnchorKind,
  CanvasConnection,
  CanvasGroup,
  CanvasItem,
  CanvasTimelineNode,
  CanvasViewport,
  EtiquettePosition,
} from '@/types';
import { getAnchorColor, getDefaultAnchorsForItem } from '@/lib/canvas/anchors';
import { attachOverlayToParent, migrateCanvasPayload } from '@/lib/canvas/migration';
import { buildCanvasTimelineHierarchy, getRelatedItemIds } from '@/lib/canvas/hierarchy';
import { viewportToCenterItem } from '@/lib/canvas/viewport';
import { STORAGE_KEYS } from '@/constants/workspace';

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 2000;

let _persistTimer: ReturnType<typeof setTimeout> | null = null;
let _isRestoring = false;

export function setCanvasRestoring(val: boolean) {
  _isRestoring = val;
}

interface CanvasSnapshot {
  items: CanvasItem[];
  groups: CanvasGroup[];
  connections: CanvasConnection[];
  anchors: CanvasAnchor[];
}

function schedulePersist() {
  if (_isRestoring || typeof window === 'undefined') return;
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    _persistTimer = null;
    try {
      const pStore =
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('@/stores/projectStore').useProjectStore.getState();
      const projectId: string | undefined = pStore.projectId;
      if (!projectId) return;
      const { items, viewport, groups, connections, anchors } = useCanvasStore.getState();
      if (items.length === 0) return;
      // Must match hooks/useProjectSync.ts's canvasStateKey() exactly — these
      // used to be two different literal strings, so this debounced write was
      // silently going to a key the load path never read.
      const key = `${STORAGE_KEYS.canvasStates}:${projectId}`;
      localStorage.setItem(
        key,
        JSON.stringify({ items, viewport, groups, connections, anchors, savedAt: Date.now() }),
      );
    } catch { /* non-fatal */ }
  }, DEBOUNCE_MS);
}

export type CanvasNavTool = 'pointer' | 'lasso' | 'hand';

export interface PendingCanvasConnection {
  itemId: string;
  anchorId: string;
  kind: CanvasAnchorKind;
  color: string;
}

interface CanvasState {
  items: CanvasItem[];
  groups: CanvasGroup[];
  connections: CanvasConnection[];
  anchors: CanvasAnchor[];
  selectedIds: string[];
  viewport: CanvasViewport;
  clipboard: CanvasItem[];
  past: CanvasSnapshot[];
  future: CanvasSnapshot[];
  activeTool: CanvasNavTool;
  showAnchors: boolean;
  pendingConnection: PendingCanvasConnection | null;
  setCanvasTool: (tool: CanvasNavTool) => void;
  setShowAnchors: (show: boolean) => void;

  // Item operations
  addItem: (item: Omit<CanvasItem, 'id' | 'createdAt' | 'zIndex'>) => CanvasItem;
  addItemFromAsset: (asset: Asset, x: number, y: number) => CanvasItem;
  removeItem: (id: string) => void;
  removeSelected: () => void;
  updateItem: (id: string, updates: Partial<CanvasItem>) => void;
  duplicateItem: (id: string) => CanvasItem | undefined;
  moveItemWithChildren: (id: string, x: number, y: number) => void;
  moveSelectedItems: (leadId: string, dx: number, dy: number, selectedIds: string[]) => void;
  moveManyItems: (movements: { id: string; x: number; y: number }[]) => void;

  // Layer / overlay
  attachLayerToParent: (layerId: string, parentId: string) => void;
  detachLayerFromParent: (layerId: string) => void;
  getChildLayers: (parentId: string) => CanvasItem[];
  getRelatedItems: (itemId: string) => CanvasItem[];

  // Etiquette
  updateEtiquettePosition: (itemId: string, position: EtiquettePosition) => void;

  // Selection
  selectItem: (id: string, additive?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  getSelectedItems: () => CanvasItem[];

  // Viewport
  setViewport: (viewport: Partial<CanvasViewport>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetViewport: () => void;

  // Z-ordering
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  reorderLayer: (itemId: string, newZIndex: number) => void;

  // Clipboard
  copy: () => void;
  paste: (offsetX?: number, offsetY?: number) => void;

  // Group operations (registry + legacy compat)
  groupItems: (itemIds: string[], name?: string) => string;
  ungroupItems: (groupId: string) => void;
  addItemToGroup: (itemId: string, groupId: string) => void;
  removeItemFromGroup: (itemId: string) => void;
  setGroupOrbit: (groupId: string, orbit: boolean) => void;
  setGroupCollapsed: (groupId: string, collapsed: boolean) => void;
  getGroupItems: (groupId: string) => CanvasItem[];
  renameGroup: (groupId: string, name: string) => void;

  // Anchor / connection graph
  ensureItemAnchors: (itemId: string) => void;
  startConnection: (itemId: string, anchorId: string, kind: CanvasAnchorKind) => void;
  completeConnection: (targetItemId: string, targetAnchorId: string) => void;
  cancelConnection: () => void;
  removeConnection: (connectionId: string) => void;
  getItemConnections: (itemId: string) => CanvasConnection[];

  // Migration / load / export
  loadCanvasGraph: (payload: {
    items?: CanvasItem[];
    groups?: CanvasGroup[];
    connections?: CanvasConnection[];
    anchors?: CanvasAnchor[];
  }) => void;
  exportTimelineHierarchy: () => CanvasTimelineNode[];
  focusItemInViewport: (itemId: string, canvasWidth?: number, canvasHeight?: number) => void;

  // Clear
  clearCanvas: () => void;
  clearAll: () => void;

  // History
  snapshot: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

function takeSnapshot(state: CanvasState): CanvasSnapshot {
  return {
    items: [...state.items],
    groups: [...state.groups],
    connections: [...state.connections],
    anchors: [...state.anchors],
  };
}

function applySnapshot(snapshot: CanvasSnapshot) {
  return {
    items: snapshot.items,
    groups: snapshot.groups,
    connections: snapshot.connections,
    anchors: snapshot.anchors,
  };
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  items: [],
  groups: [],
  connections: [],
  anchors: [],
  selectedIds: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  clipboard: [],
  past: [],
  future: [],
  activeTool: 'pointer',
  showAnchors: false,
  pendingConnection: null,
  setCanvasTool: (tool) => set({ activeTool: tool }),
  setShowAnchors: (show) => set({ showAnchors: show }),

  snapshot: () => {
    const state = get();
    const snap = takeSnapshot(state);
    set({ past: [...state.past, snap].slice(-MAX_HISTORY), future: [] });
  },

  undo: () => {
    const { past, future } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    set({
      ...applySnapshot(prev),
      past: past.slice(0, -1),
      future: [takeSnapshot(get()), ...future].slice(0, MAX_HISTORY),
      selectedIds: [],
    });
    schedulePersist();
  },

  redo: () => {
    const { past, future } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      ...applySnapshot(next),
      past: [...past, takeSnapshot(get())].slice(-MAX_HISTORY),
      future: future.slice(1),
      selectedIds: [],
    });
    schedulePersist();
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  addItem: (itemData) => {
    get().snapshot();
    const maxZ = Math.max(0, ...get().items.map((i) => i.zIndex));
    const item: CanvasItem = {
      ...itemData,
      id: uuidv4(),
      createdAt: Date.now(),
      zIndex: maxZ + 1,
      etiquettePosition: itemData.etiquettePosition ?? { x: 0, y: -28 },
      connectionIds: itemData.connectionIds ?? [],
    };
    const newAnchors = getDefaultAnchorsForItem(item);
    set((state) => ({
      items: [...state.items, item],
      anchors: [...state.anchors, ...newAnchors],
    }));
    schedulePersist();
    return item;
  },

  addItemFromAsset: (asset, x, y) => {
    const metadata = asset.metadata || {};
    const isPrompt = asset.type === 'prompt';

    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const defaultSize = Math.min(320, Math.round(screenW * 0.2));

    const width = metadata.width || (isPrompt ? Math.min(280, defaultSize) : defaultSize);
    const height = metadata.height || (isPrompt ? Math.min(180, Math.round(defaultSize * 0.6)) : defaultSize);

    const typeMap: Record<string, CanvasItem['type']> = {
      image: 'image',
      video: 'video',
      audio: 'audio',
      text: 'text',
      prompt: 'placeholder',
      folder: 'placeholder',
    };
    const itemType = typeMap[asset.type] || 'image';

    return get().addItem({
      assetId: asset.id,
      type: itemType,
      x,
      y,
      width,
      height,
      rotation: 0,
      scale: 1,
      locked: false,
      visible: true,
      src: isPrompt ? '' : ((asset as { dataUrl?: string }).dataUrl || asset.thumbnail || ''),
      name: asset.name,
      prompt: metadata.prompt || (isPrompt ? asset.name : undefined),
      promptId: metadata.promptId || (isPrompt ? asset.id : undefined),
      lineageId: metadata.lineageId,
      version: metadata.version,
      parentAssetId: metadata.parentAssetId,
      layerRole: isPrompt ? 'prompt' : metadata.source === 'generated' ? 'generated' : 'base',
      mediaMeta: {
        mimeType: metadata.mimeType,
        fileSize: metadata.fileSize,
        duration: metadata.duration,
        fps: metadata.fps,
        codec: metadata.codec,
        bitRate: metadata.bitRate,
        channels: metadata.channels,
        sampleRate: metadata.sampleRate,
        source: metadata.source,
      },
    });
  },

  removeItem: (id) => {
    get().snapshot();
    const childIds = get().items.filter((i) => i.parentItemId === id).map((i) => i.id);
    const removeSet = new Set([id, ...childIds]);
    set((state) => ({
      items: state.items.filter((i) => !removeSet.has(i.id)),
      selectedIds: state.selectedIds.filter((sid) => !removeSet.has(sid)),
      connections: state.connections.filter(
        (c) => !removeSet.has(c.sourceItemId) && !removeSet.has(c.targetItemId),
      ),
      anchors: state.anchors.filter((a) => !removeSet.has(a.itemId)),
      groups: state.groups.map((g) => ({
        ...g,
        itemIds: g.itemIds.filter((iid) => !removeSet.has(iid)),
      })).filter((g) => g.itemIds.length > 0),
    }));
    schedulePersist();
  },

  removeSelected: () => {
    get().snapshot();
    const { selectedIds, items } = get();
    const removeSet = new Set<string>();
    for (const id of selectedIds) {
      removeSet.add(id);
      for (const child of items.filter((i) => i.parentItemId === id)) {
        removeSet.add(child.id);
      }
    }
    set((state) => ({
      items: state.items.filter((i) => !removeSet.has(i.id)),
      selectedIds: [],
      connections: state.connections.filter(
        (c) => !removeSet.has(c.sourceItemId) && !removeSet.has(c.targetItemId),
      ),
      anchors: state.anchors.filter((a) => !removeSet.has(a.itemId)),
      groups: state.groups.map((g) => ({
        ...g,
        itemIds: g.itemIds.filter((iid) => !removeSet.has(iid)),
      })).filter((g) => g.itemIds.length > 0),
    }));
    schedulePersist();
  },

  updateItem: (id, updates) => {
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, ...updates, updatedAt: Date.now() } : i)),
    }));
    schedulePersist();
  },

  moveItemWithChildren: (id, x, y) => {
    const state = get();
    const item = state.items.find((i) => i.id === id);
    if (!item) return;

    const dx = x - item.x;
    const dy = y - item.y;
    const childIds = state.items.filter((i) => i.parentItemId === id).map((i) => i.id);
    const moveIds = new Set([id, ...childIds]);

    set({
      items: state.items.map((i) => {
        if (!moveIds.has(i.id)) return i;
        if (i.id === id) return { ...i, x, y, updatedAt: Date.now() };
        if (i.parentItemId === id && i.layerOffset) {
          return {
            ...i,
            x: x + i.layerOffset.x,
            y: y + i.layerOffset.y,
            updatedAt: Date.now(),
          };
        }
        return { ...i, x: i.x + dx, y: i.y + dy, updatedAt: Date.now() };
      }),
    });
    schedulePersist();
  },

  moveSelectedItems: (leadId, dx, dy, selectedIds) => {
    // dx, dy = delta from each item's DRAG-START origin (provided by caller's ref).
    // This is intentionally called each frame with the SAME accumulated delta from origin,
    // NOT the delta from last frame. The caller must update all item positions to
    // origin + dx/dy to avoid drift. We use a movements map passed in.
    // The caller stores origins in `multiDragOrigins.current`, so it should call
    // `moveManyItems` instead. This method is kept for API compatibility.
    get().moveManyItems(
      selectedIds.map((id) => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return { id, x: 0, y: 0 };
        return { id, x: item.x + dx, y: item.y + dy };
      })
    );
  },

  moveManyItems: (movements) => {
    const state = get();
    const movMap = new Map(movements.map((m) => [m.id, m]));
    const ts = Date.now();
    // Build set of parent IDs being moved
    const movedParents = new Set(movements.map((m) => m.id));
    set({
      items: state.items.map((i) => {
        const mov = movMap.get(i.id);
        if (mov) return { ...i, x: mov.x, y: mov.y, updatedAt: ts };
        // Move child overlay layers that belong to a moved parent
        if (i.parentItemId && movedParents.has(i.parentItemId) && i.layerOffset) {
          const parentMov = movMap.get(i.parentItemId);
          if (parentMov) return { ...i, x: parentMov.x + i.layerOffset.x, y: parentMov.y + i.layerOffset.y, updatedAt: ts };
        }
        return i;
      }),
    });
    schedulePersist();
  },

  attachLayerToParent: (layerId, parentId) => {
    get().snapshot();
    const layer = get().items.find((i) => i.id === layerId);
    const parent = get().items.find((i) => i.id === parentId);
    if (!layer || !parent) return;
    get().updateItem(layerId, attachOverlayToParent(layer, parent));
  },

  detachLayerFromParent: (layerId) => {
    get().snapshot();
    get().updateItem(layerId, { parentItemId: undefined, layerRole: 'base', layerOffset: undefined });
  },

  getChildLayers: (parentId) => get().items.filter((i) => i.parentItemId === parentId),

  getRelatedItems: (itemId) => {
    const { items, connections } = get();
    const ids = getRelatedItemIds(itemId, items, connections);
    return items.filter((i) => ids.includes(i.id));
  },

  updateEtiquettePosition: (itemId, position) => {
    get().updateItem(itemId, { etiquettePosition: position });
  },

  duplicateItem: (id) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return undefined;
    return get().addItem({
      ...item,
      x: item.x + 20,
      y: item.y + 20,
      name: `${item.name} (copy)`,
      parentItemId: undefined,
      layerOffset: undefined,
    });
  },

  selectItem: (id, additive = false) => {
    set((state) => ({
      selectedIds: additive
        ? state.selectedIds.includes(id)
          ? state.selectedIds.filter((sid) => sid !== id)
          : [...state.selectedIds, id]
        : [id],
    }));
  },

  selectAll: () => {
    set((state) => ({ selectedIds: state.items.map((i) => i.id) }));
  },

  clearSelection: () => {
    set({ selectedIds: [] });
  },

  getSelectedItems: () => {
    const { items, selectedIds } = get();
    return items.filter((i) => selectedIds.includes(i.id));
  },

  setViewport: (viewport) => {
    set((state) => ({ viewport: { ...state.viewport, ...viewport } }));
  },

  zoomIn: () => {
    set((state) => ({
      viewport: { ...state.viewport, zoom: Math.min(5, state.viewport.zoom * 1.2) },
    }));
  },

  zoomOut: () => {
    set((state) => ({
      viewport: { ...state.viewport, zoom: Math.max(0.1, state.viewport.zoom / 1.2) },
    }));
  },

  resetViewport: () => {
    set({ viewport: { x: 0, y: 0, zoom: 1 } });
  },

  bringToFront: (id) => {
    const maxZ = Math.max(0, ...get().items.map((i) => i.zIndex));
    get().updateItem(id, { zIndex: maxZ + 1 });
  },

  sendToBack: (id) => {
    const minZ = Math.min(0, ...get().items.map((i) => i.zIndex));
    get().updateItem(id, { zIndex: minZ - 1 });
  },

  reorderLayer: (itemId, newZIndex) => {
    get().snapshot();
    get().updateItem(itemId, { zIndex: newZIndex });
  },

  copy: () => {
    const selected = get().getSelectedItems();
    set({ clipboard: selected });
  },

  paste: (offsetX = 20, offsetY = 20) => {
    get().snapshot();
    const { clipboard } = get();
    const newIds: string[] = [];
    for (const item of clipboard) {
      const newItem = get().addItem({
        ...item,
        x: item.x + offsetX,
        y: item.y + offsetY,
        name: `${item.name} (copy)`,
        parentItemId: undefined,
        layerOffset: undefined,
      });
      newIds.push(newItem.id);
    }
    set({ selectedIds: newIds });
  },

  groupItems: (itemIds, name = 'Group') => {
    const groupId = uuidv4();
    get().snapshot();
    const group: CanvasGroup = {
      id: groupId,
      name,
      itemIds: [...itemIds],
      collapsed: false,
      orbit: false,
      stackOrder: get().groups.length,
      createdAt: Date.now(),
    };
    set((state) => ({
      groups: [...state.groups, group],
      items: state.items.map((i) =>
        itemIds.includes(i.id) ? { ...i, groupId } : i,
      ),
    }));
    schedulePersist();
    return groupId;
  },

  ungroupItems: (groupId) => {
    get().snapshot();
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== groupId),
      items: state.items.map((i) =>
        i.groupId === groupId ? { ...i, groupId: undefined, groupOrbit: undefined } : i,
      ),
    }));
    schedulePersist();
  },

  addItemToGroup: (itemId, groupId) => {
    get().snapshot();
    set((state) => ({
      items: state.items.map((i) =>
        i.id === itemId ? { ...i, groupId } : i,
      ),
      groups: state.groups.map((g) =>
        g.id === groupId && !g.itemIds.includes(itemId)
          ? { ...g, itemIds: [...g.itemIds, itemId] }
          : g,
      ),
    }));
    schedulePersist();
  },

  removeItemFromGroup: (itemId) => {
    get().snapshot();
    const item = get().items.find((i) => i.id === itemId);
    set((state) => ({
      items: state.items.map((i) =>
        i.id === itemId ? { ...i, groupId: undefined, groupOrbit: undefined } : i,
      ),
      groups: state.groups.map((g) =>
        g.id === item?.groupId
          ? { ...g, itemIds: g.itemIds.filter((id) => id !== itemId) }
          : g,
      ).filter((g) => g.itemIds.length > 0),
    }));
    schedulePersist();
  },

  setGroupOrbit: (groupId, orbit) => {
    set((state) => ({
      groups: state.groups.map((g) => (g.id === groupId ? { ...g, orbit } : g)),
      items: state.items.map((i) =>
        i.groupId === groupId ? { ...i, groupOrbit: orbit } : i,
      ),
    }));
    schedulePersist();
  },

  setGroupCollapsed: (groupId, collapsed) => {
    set((state) => ({
      groups: state.groups.map((g) => (g.id === groupId ? { ...g, collapsed } : g)),
    }));
    schedulePersist();
  },

  getGroupItems: (groupId) => get().items.filter((i) => i.groupId === groupId),

  renameGroup: (groupId, name) => {
    set((state) => ({
      groups: state.groups.map((g) => (g.id === groupId ? { ...g, name } : g)),
    }));
    schedulePersist();
  },

  ensureItemAnchors: (itemId) => {
    const item = get().items.find((i) => i.id === itemId);
    if (!item) return;
    const existing = get().anchors.filter((a) => a.itemId === itemId);
    if (existing.length > 0) return;
    set((state) => ({
      anchors: [...state.anchors, ...getDefaultAnchorsForItem(item)],
    }));
  },

  startConnection: (itemId, anchorId, kind) => {
    set({
      pendingConnection: {
        itemId,
        anchorId,
        kind,
        color: getAnchorColor(kind),
      },
    });
  },

  completeConnection: (targetItemId, targetAnchorId) => {
    const pending = get().pendingConnection;
    if (!pending || pending.itemId === targetItemId) {
      set({ pendingConnection: null });
      return;
    }
    get().snapshot();
    const connection: CanvasConnection = {
      id: uuidv4(),
      sourceItemId: pending.itemId,
      targetItemId,
      sourceAnchorId: pending.anchorId,
      targetAnchorId,
      kind: pending.kind,
      color: pending.color,
      createdAt: Date.now(),
    };
    set((state) => ({
      connections: [...state.connections, connection],
      pendingConnection: null,
      items: state.items.map((i) => {
        if (i.id === pending.itemId) {
          return { ...i, connectionIds: [...(i.connectionIds ?? []), connection.id] };
        }
        if (i.id === targetItemId) {
          return { ...i, connectionIds: [...(i.connectionIds ?? []), connection.id] };
        }
        return i;
      }),
    }));
    schedulePersist();
  },

  cancelConnection: () => set({ pendingConnection: null }),

  removeConnection: (connectionId) => {
    get().snapshot();
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== connectionId),
      items: state.items.map((i) => ({
        ...i,
        connectionIds: (i.connectionIds ?? []).filter((cid) => cid !== connectionId),
      })),
    }));
    schedulePersist();
  },

  getItemConnections: (itemId) =>
    get().connections.filter((c) => c.sourceItemId === itemId || c.targetItemId === itemId),

  loadCanvasGraph: (payload) => {
    const migrated = migrateCanvasPayload(payload);
    set({
      items: migrated.items,
      groups: migrated.groups,
      connections: migrated.connections,
      anchors: migrated.anchors,
    });
    schedulePersist();
  },

  exportTimelineHierarchy: () =>
    buildCanvasTimelineHierarchy(get().items, get().connections),

  focusItemInViewport: (itemId, canvasWidth, canvasHeight) => {
    const item = get().items.find((i) => i.id === itemId);
    if (!item) return;
    const cw = canvasWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1920);
    const ch = canvasHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 1080);
    const vp = get().viewport;
    set({
      viewport: { ...vp, ...viewportToCenterItem(item, vp, cw, ch) },
      selectedIds: [itemId],
    });
  },

  clearCanvas: () => {
    get().snapshot();
    set({ items: [], selectedIds: [], groups: [], connections: [], anchors: [] });
  },

  clearAll: () => {
    set({
      items: [],
      groups: [],
      connections: [],
      anchors: [],
      selectedIds: [],
      clipboard: [],
      past: [],
      future: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      pendingConnection: null,
    });
  },
}));
