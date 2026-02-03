/**
 * Canvas Store Unit Tests
 * 
 * Tests for the canvas state management including:
 * - Item CRUD operations
 * - Selection management
 * - Viewport manipulation
 * - Clipboard operations
 * - Z-index management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockCanvasItem, createMockAsset } from '../setup';

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9),
}));

// Import after mocks
import { useCanvasStore } from '../../stores/canvasStore';

describe('CanvasStore', () => {
  beforeEach(() => {
    // Reset the store state
    useCanvasStore.setState({
      items: [],
      selectedIds: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      clipboard: [],
    });
  });

  describe('Item Operations', () => {
    it('should add an item to the canvas', () => {
      const store = useCanvasStore.getState();
      const mockItem = createMockCanvasItem();
      
      // addItem expects item without id, createdAt, zIndex (they're auto-generated)
      const { id, createdAt, zIndex, ...itemWithoutIdAndMeta } = mockItem;
      store.addItem(itemWithoutIdAndMeta);
      
      const state = useCanvasStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].name).toBe('Test Item');
    });

    it('should add item from asset', () => {
      const store = useCanvasStore.getState();
      const mockAsset = createMockAsset();
      
      store.addItemFromAsset(mockAsset as any, 50, 50);
      
      const state = useCanvasStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].x).toBe(50);
      expect(state.items[0].y).toBe(50);
    });

    it('should update an existing item', () => {
      const store = useCanvasStore.getState();
      
      // Add item and get its generated ID
      const { id, createdAt, zIndex, ...itemData } = createMockCanvasItem();
      const addedItem = store.addItem(itemData);
      
      store.updateItem(addedItem.id, { x: 200, y: 300 });
      
      const state = useCanvasStore.getState();
      expect(state.items[0].x).toBe(200);
      expect(state.items[0].y).toBe(300);
    });

    it('should remove an item by id', () => {
      const store = useCanvasStore.getState();
      
      // Add item and get its generated ID
      const { id, createdAt, zIndex, ...itemData } = createMockCanvasItem();
      const addedItem = store.addItem(itemData);
      
      expect(useCanvasStore.getState().items).toHaveLength(1);
      
      store.removeItem(addedItem.id);
      expect(useCanvasStore.getState().items).toHaveLength(0);
    });

    it('should remove selected items', () => {
      const store = useCanvasStore.getState();
      
      // Add items and get their IDs
      const { id: id1, createdAt: c1, zIndex: z1, ...item1Data } = createMockCanvasItem({ name: 'Item 1' });
      const { id: id2, createdAt: c2, zIndex: z2, ...item2Data } = createMockCanvasItem({ name: 'Item 2' });
      const { id: id3, createdAt: c3, zIndex: z3, ...item3Data } = createMockCanvasItem({ name: 'Item 3' });
      
      const added1 = store.addItem(item1Data);
      const added2 = store.addItem(item2Data);
      const added3 = store.addItem(item3Data);
      
      store.selectItem(added1.id, false);
      store.selectItem(added2.id, true);
      store.removeSelected();
      
      const state = useCanvasStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].name).toBe('Item 3');
    });

    it('should clear all items from canvas', () => {
      const store = useCanvasStore.getState();
      const { id: id1, createdAt: c1, zIndex: z1, ...item1Data } = createMockCanvasItem();
      const { id: id2, createdAt: c2, zIndex: z2, ...item2Data } = createMockCanvasItem();
      
      store.addItem(item1Data);
      store.addItem(item2Data);
      
      store.clearCanvas();
      
      expect(useCanvasStore.getState().items).toHaveLength(0);
    });

    it('should duplicate an item', () => {
      const store = useCanvasStore.getState();
      const { id, createdAt, zIndex, ...itemData } = createMockCanvasItem({ name: 'Original' });
      const added = store.addItem(itemData);
      
      const duplicated = store.duplicateItem(added.id);
      
      const state = useCanvasStore.getState();
      expect(state.items).toHaveLength(2);
      expect(duplicated?.name).toBe('Original (copy)');
      expect(duplicated?.x).toBe(itemData.x + 20);
    });
  });

  describe('Selection Management', () => {
    it('should select a single item', () => {
      const store = useCanvasStore.getState();
      const { id, createdAt, zIndex, ...itemData } = createMockCanvasItem();
      const added = store.addItem(itemData);
      
      store.selectItem(added.id, false);
      
      const state = useCanvasStore.getState();
      expect(state.selectedIds).toContain(added.id);
      expect(state.selectedIds).toHaveLength(1);
    });

    it('should add to selection with additive flag', () => {
      const store = useCanvasStore.getState();
      const { id: id1, createdAt: c1, zIndex: z1, ...item1Data } = createMockCanvasItem();
      const { id: id2, createdAt: c2, zIndex: z2, ...item2Data } = createMockCanvasItem();
      
      const added1 = store.addItem(item1Data);
      const added2 = store.addItem(item2Data);
      
      store.selectItem(added1.id, false);
      store.selectItem(added2.id, true);
      
      const state = useCanvasStore.getState();
      expect(state.selectedIds).toHaveLength(2);
      expect(state.selectedIds).toContain(added1.id);
      expect(state.selectedIds).toContain(added2.id);
    });

    it('should toggle selection with additive on same item', () => {
      const store = useCanvasStore.getState();
      const { id, createdAt, zIndex, ...itemData } = createMockCanvasItem();
      const added = store.addItem(itemData);
      
      store.selectItem(added.id, false);
      expect(useCanvasStore.getState().selectedIds).toContain(added.id);
      
      store.selectItem(added.id, true);
      expect(useCanvasStore.getState().selectedIds).not.toContain(added.id);
    });

    it('should clear selection', () => {
      const store = useCanvasStore.getState();
      const { id, createdAt, zIndex, ...itemData } = createMockCanvasItem();
      const added = store.addItem(itemData);
      store.selectItem(added.id, false);
      
      store.clearSelection();
      
      expect(useCanvasStore.getState().selectedIds).toHaveLength(0);
    });

    it('should select all items', () => {
      const store = useCanvasStore.getState();
      const { id: id1, createdAt: c1, zIndex: z1, ...item1Data } = createMockCanvasItem();
      const { id: id2, createdAt: c2, zIndex: z2, ...item2Data } = createMockCanvasItem();
      const { id: id3, createdAt: c3, zIndex: z3, ...item3Data } = createMockCanvasItem();
      
      store.addItem(item1Data);
      store.addItem(item2Data);
      store.addItem(item3Data);
      
      store.selectAll();
      
      expect(useCanvasStore.getState().selectedIds).toHaveLength(3);
    });

    it('should get selected items', () => {
      const store = useCanvasStore.getState();
      const { id: id1, createdAt: c1, zIndex: z1, ...item1Data } = createMockCanvasItem({ name: 'Item 1' });
      const { id: id2, createdAt: c2, zIndex: z2, ...item2Data } = createMockCanvasItem({ name: 'Item 2' });
      
      const added1 = store.addItem(item1Data);
      store.addItem(item2Data);
      
      store.selectItem(added1.id, false);
      
      const selected = store.getSelectedItems();
      expect(selected).toHaveLength(1);
      expect(selected[0].name).toBe('Item 1');
    });
  });

  describe('Viewport Operations', () => {
    it('should set viewport position and zoom', () => {
      const store = useCanvasStore.getState();
      
      store.setViewport({ x: 100, y: 200, zoom: 1.5 });
      
      const state = useCanvasStore.getState();
      expect(state.viewport.x).toBe(100);
      expect(state.viewport.y).toBe(200);
      expect(state.viewport.zoom).toBe(1.5);
    });

    it('should zoom in', () => {
      const store = useCanvasStore.getState();
      store.setViewport({ x: 0, y: 0, zoom: 1 });
      
      store.zoomIn();
      
      expect(useCanvasStore.getState().viewport.zoom).toBeGreaterThan(1);
    });

    it('should zoom out', () => {
      const store = useCanvasStore.getState();
      store.setViewport({ x: 0, y: 0, zoom: 1 });
      
      store.zoomOut();
      
      expect(useCanvasStore.getState().viewport.zoom).toBeLessThan(1);
    });

    it('should reset viewport to defaults', () => {
      const store = useCanvasStore.getState();
      store.setViewport({ x: 500, y: 500, zoom: 2 });
      
      store.resetViewport();
      
      const state = useCanvasStore.getState();
      expect(state.viewport.x).toBe(0);
      expect(state.viewport.y).toBe(0);
      expect(state.viewport.zoom).toBe(1);
    });

    it('should respect zoom limits', () => {
      const store = useCanvasStore.getState();
      
      // Zoom in to max (max is 5 per implementation)
      for (let i = 0; i < 20; i++) {
        store.zoomIn();
      }
      expect(useCanvasStore.getState().viewport.zoom).toBeLessThanOrEqual(5);
      
      // Zoom out to min (min is 0.1 per implementation)
      store.resetViewport();
      for (let i = 0; i < 20; i++) {
        store.zoomOut();
      }
      expect(useCanvasStore.getState().viewport.zoom).toBeGreaterThanOrEqual(0.1);
    });
  });

  describe('Clipboard Operations', () => {
    it('should copy selected items', () => {
      const store = useCanvasStore.getState();
      const { id, createdAt, zIndex, ...itemData } = createMockCanvasItem({ name: 'Copy Me' });
      const added = store.addItem(itemData);
      store.selectItem(added.id, false);
      
      store.copy();
      
      expect(useCanvasStore.getState().clipboard).toHaveLength(1);
      expect(useCanvasStore.getState().clipboard[0].name).toBe('Copy Me');
    });

    it('should paste copied items at offset', () => {
      const store = useCanvasStore.getState();
      const { id, createdAt, zIndex, ...itemData } = createMockCanvasItem({ x: 100, y: 100 });
      const added = store.addItem(itemData);
      store.selectItem(added.id, false);
      store.copy();
      
      store.paste();
      
      const state = useCanvasStore.getState();
      expect(state.items).toHaveLength(2);
      // Pasted item should be offset by 20 (default)
      expect(state.items[1].x).toBe(120);
      expect(state.items[1].y).toBe(120);
    });

    it('should not paste when clipboard is empty', () => {
      const store = useCanvasStore.getState();
      // clipboard is [] by default
      
      store.paste();
      
      expect(useCanvasStore.getState().items).toHaveLength(0);
    });

    it('should paste with custom offset', () => {
      const store = useCanvasStore.getState();
      const { id, createdAt, zIndex, ...itemData } = createMockCanvasItem({ x: 100, y: 100 });
      const added = store.addItem(itemData);
      store.selectItem(added.id, false);
      store.copy();
      
      store.paste(50, 50);
      
      const state = useCanvasStore.getState();
      expect(state.items[1].x).toBe(150);
      expect(state.items[1].y).toBe(150);
    });

    it('should select pasted items', () => {
      const store = useCanvasStore.getState();
      const { id, createdAt, zIndex, ...itemData } = createMockCanvasItem();
      const added = store.addItem(itemData);
      store.selectItem(added.id, false);
      store.copy();
      
      store.paste();
      
      const state = useCanvasStore.getState();
      // Selection should be the pasted item, not the original
      expect(state.selectedIds).toHaveLength(1);
      expect(state.selectedIds[0]).not.toBe(added.id);
    });
  });

  describe('Z-Index Management', () => {
    it('should bring item to front', () => {
      const store = useCanvasStore.getState();
      const { id: id1, createdAt: c1, zIndex: z1, ...item1Data } = createMockCanvasItem();
      const { id: id2, createdAt: c2, zIndex: z2, ...item2Data } = createMockCanvasItem();
      const { id: id3, createdAt: c3, zIndex: z3, ...item3Data } = createMockCanvasItem();
      
      const added1 = store.addItem(item1Data);
      const added2 = store.addItem(item2Data);
      const added3 = store.addItem(item3Data);
      
      // Bring item 1 to front
      store.bringToFront(added1.id);
      
      const state = useCanvasStore.getState();
      const item1 = state.items.find(i => i.id === added1.id);
      const item3 = state.items.find(i => i.id === added3.id);
      expect(item1?.zIndex).toBeGreaterThan(item3?.zIndex ?? 0);
    });

    it('should send item to back', () => {
      const store = useCanvasStore.getState();
      const { id: id1, createdAt: c1, zIndex: z1, ...item1Data } = createMockCanvasItem();
      const { id: id2, createdAt: c2, zIndex: z2, ...item2Data } = createMockCanvasItem();
      const { id: id3, createdAt: c3, zIndex: z3, ...item3Data } = createMockCanvasItem();
      
      const added1 = store.addItem(item1Data);
      const added2 = store.addItem(item2Data);
      const added3 = store.addItem(item3Data);
      
      // Send item 3 to back
      store.sendToBack(added3.id);
      
      const state = useCanvasStore.getState();
      const item3 = state.items.find(i => i.id === added3.id);
      const item1 = state.items.find(i => i.id === added1.id);
      expect(item3?.zIndex).toBeLessThan(item1?.zIndex ?? 0);
    });

    it('should assign incremental z-index when adding items', () => {
      const store = useCanvasStore.getState();
      const { id: id1, createdAt: c1, zIndex: z1, ...item1Data } = createMockCanvasItem();
      const { id: id2, createdAt: c2, zIndex: z2, ...item2Data } = createMockCanvasItem();
      
      const added1 = store.addItem(item1Data);
      const added2 = store.addItem(item2Data);
      
      const state = useCanvasStore.getState();
      const item1 = state.items.find(i => i.id === added1.id);
      const item2 = state.items.find(i => i.id === added2.id);
      
      expect(item2?.zIndex).toBeGreaterThan(item1?.zIndex ?? 0);
    });
  });

  describe('Item Visibility and Lock', () => {
    it('should update item locked state via updateItem', () => {
      const store = useCanvasStore.getState();
      const { id, createdAt, zIndex, ...itemData } = createMockCanvasItem({ locked: false });
      const added = store.addItem(itemData);
      
      store.updateItem(added.id, { locked: true });
      
      const state = useCanvasStore.getState();
      expect(state.items[0].locked).toBe(true);
    });

    it('should update item visible state via updateItem', () => {
      const store = useCanvasStore.getState();
      const { id, createdAt, zIndex, ...itemData } = createMockCanvasItem({ visible: true });
      const added = store.addItem(itemData);
      
      store.updateItem(added.id, { visible: false });
      
      const state = useCanvasStore.getState();
      expect(state.items[0].visible).toBe(false);
    });
  });
});
