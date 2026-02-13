import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { CanvasItem, CanvasViewport, Asset } from '@/types';

interface CanvasState {
  items: CanvasItem[];
  selectedIds: string[];
  viewport: CanvasViewport;
  clipboard: CanvasItem[];

  // Item operations
  addItem: (item: Omit<CanvasItem, 'id' | 'createdAt' | 'zIndex'>) => CanvasItem;
  addItemFromAsset: (asset: Asset, x: number, y: number) => CanvasItem;
  removeItem: (id: string) => void;
  removeSelected: () => void;
  updateItem: (id: string, updates: Partial<CanvasItem>) => void;
  duplicateItem: (id: string) => CanvasItem | undefined;

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

  // Clipboard
  copy: () => void;
  paste: (offsetX?: number, offsetY?: number) => void;

  // Clear
  clearCanvas: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  items: [],
  selectedIds: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  clipboard: [],

  addItem: (itemData) => {
    const maxZ = Math.max(0, ...get().items.map((i) => i.zIndex));
    const item: CanvasItem = {
      ...itemData,
      id: uuidv4(),
      createdAt: Date.now(),
      zIndex: maxZ + 1,
    };
    set((state) => ({ items: [...state.items, item] }));
    return item;
  },

  addItemFromAsset: (asset, x, y) => {
    const metadata = asset.metadata || {};
    const isPrompt = asset.type === 'prompt';
    
    // Default size proportional to screen, ~1/4 viewport width, max 320px
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const defaultSize = Math.min(320, Math.round(screenW * 0.2));
    
    const width = metadata.width || (isPrompt ? Math.min(280, defaultSize) : defaultSize);
    const height = metadata.height || (isPrompt ? Math.min(180, Math.round(defaultSize * 0.6)) : defaultSize);

    return get().addItem({
      assetId: asset.id,
      type: isPrompt ? 'placeholder' : 'image',
      x,
      y,
      width,
      height,
      rotation: 0,
      scale: 1,
      locked: false,
      visible: true,
      src: isPrompt ? '' : ((asset as any).dataUrl || asset.thumbnail || ''),
      name: asset.name,
      prompt: metadata.prompt || (isPrompt ? asset.name : undefined),
      promptId: metadata.promptId || (isPrompt ? asset.id : undefined),
      lineageId: metadata.lineageId,
      version: metadata.version,
      parentAssetId: metadata.parentAssetId,
    });
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
      selectedIds: state.selectedIds.filter((sid) => sid !== id),
    }));
  },

  removeSelected: () => {
    const { selectedIds } = get();
    set((state) => ({
      items: state.items.filter((i) => !selectedIds.includes(i.id)),
      selectedIds: [],
    }));
  },

  updateItem: (id, updates) => {
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    }));
  },

  duplicateItem: (id) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return undefined;

    return get().addItem({
      ...item,
      x: item.x + 20,
      y: item.y + 20,
      name: `${item.name} (copy)`,
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
    set((state) => ({
      selectedIds: state.items.map((i) => i.id),
    }));
  },

  clearSelection: () => {
    set({ selectedIds: [] });
  },

  getSelectedItems: () => {
    const { items, selectedIds } = get();
    return items.filter((i) => selectedIds.includes(i.id));
  },

  setViewport: (viewport) => {
    set((state) => ({
      viewport: { ...state.viewport, ...viewport },
    }));
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

  copy: () => {
    const selected = get().getSelectedItems();
    set({ clipboard: selected });
  },

  paste: (offsetX = 20, offsetY = 20) => {
    const { clipboard, addItem } = get();
    const newIds: string[] = [];

    clipboard.forEach((item) => {
      const newItem = addItem({
        ...item,
        x: item.x + offsetX,
        y: item.y + offsetY,
        name: `${item.name} (copy)`,
      });
      newIds.push(newItem.id);
    });

    set({ selectedIds: newIds });
  },

  clearCanvas: () => {
    set({ items: [], selectedIds: [] });
  },
}));
