import { describe, it, expect, beforeEach, vi } from 'vitest';
import { migrateCanvasPayload, attachOverlayToParent, findParentItemAtPoint } from '../../lib/canvas/migration';
import { getDefaultAnchorsForItem, getAnchorColor } from '../../lib/canvas/anchors';
import { buildCanvasTimelineHierarchy, getRelatedItemIds } from '../../lib/canvas/hierarchy';
import { exportTimelineHandoff } from '../../lib/canvas/timeline-handoff';
import type { CanvasItem } from '../../types';
import { useCanvasStore } from '../../stores/canvasStore';

vi.mock('uuid', () => ({
  v4: vi.fn(() => `mock-${Math.random().toString(36).slice(2, 9)}`),
}));

function makeItem(overrides: Partial<CanvasItem> = {}): CanvasItem {
  return {
    id: overrides.id ?? 'item-1',
    type: 'image',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    rotation: 0,
    scale: 1,
    zIndex: 1,
    locked: false,
    visible: true,
    name: 'Test',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('canvas graph utilities', () => {
  describe('migrateCanvasPayload', () => {
    it('migrates legacy groupId into group registry', () => {
      const gid = 'legacy-group';
      const items = [
        makeItem({ id: 'a', groupId: gid }),
        makeItem({ id: 'b', groupId: gid, groupOrbit: true }),
      ];
      const result = migrateCanvasPayload({ items });
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].id).toBe(gid);
      expect(result.groups[0].itemIds).toEqual(['a', 'b']);
      expect(result.groups[0].orbit).toBe(true);
    });

    it('creates default anchors for items', () => {
      const items = [makeItem({ prompt: 'hello' })];
      const result = migrateCanvasPayload({ items });
      expect(result.anchors.length).toBeGreaterThan(0);
    });
  });

  describe('attachOverlayToParent', () => {
    it('sets relative layer offset from parent', () => {
      const parent = makeItem({ id: 'parent', x: 100, y: 50 });
      const overlay = makeItem({ id: 'child', x: 120, y: 80 });
      const patch = attachOverlayToParent(overlay, parent);
      expect(patch.parentItemId).toBe('parent');
      expect(patch.layerRole).toBe('overlay');
      expect(patch.layerOffset).toEqual({ x: 20, y: 30, scale: 1, rotation: 0 });
    });
  });

  describe('findParentItemAtPoint', () => {
    it('finds topmost image at point', () => {
      const items = [
        makeItem({ id: 'low', x: 0, y: 0, zIndex: 1, type: 'image' }),
        makeItem({ id: 'high', x: 0, y: 0, zIndex: 5, type: 'generated' }),
      ];
      const found = findParentItemAtPoint(items, 50, 50);
      expect(found?.id).toBe('high');
    });
  });

  describe('anchors', () => {
    it('returns color per kind', () => {
      expect(getAnchorColor('prompt')).toBe('#f59e0b');
      expect(getAnchorColor('layer')).toBe('#22c55e');
    });

    it('creates prompt anchor when item has prompt', () => {
      const anchors = getDefaultAnchorsForItem(makeItem({ prompt: 'test' }));
      expect(anchors.some((a) => a.kind === 'prompt')).toBe(true);
    });
  });

  describe('hierarchy', () => {
    it('builds nested timeline hierarchy', () => {
      const items = [
        makeItem({ id: 'parent', zIndex: 1 }),
        makeItem({ id: 'child', parentItemId: 'parent', layerRole: 'overlay', zIndex: 2 }),
      ];
      const tree = buildCanvasTimelineHierarchy(items, []);
      expect(tree).toHaveLength(1);
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].itemId).toBe('child');
    });

    it('collects related item ids', () => {
      const items = [
        makeItem({ id: 'parent' }),
        makeItem({ id: 'child', parentItemId: 'parent' }),
      ];
      const related = getRelatedItemIds('parent', items, []);
      expect(related).toContain('child');
    });
  });

  describe('exportTimelineHandoff', () => {
    it('exports hierarchy and scene groupings', () => {
      const items = [
        makeItem({ id: 's1', sceneId: 'scene-a' }),
        makeItem({ id: 's2', sceneId: 'scene-a' }),
      ];
      const payload = exportTimelineHandoff(items, []);
      expect(payload.hierarchy).toHaveLength(2);
      expect(payload.sceneItems).toHaveLength(1);
      expect(payload.sceneItems[0].itemIds).toEqual(['s1', 's2']);
    });
  });
});

describe('canvas store graph operations', () => {
  beforeEach(() => {
    useCanvasStore.getState().clearAll();
  });

  it('creates and removes connections', () => {
    const a = useCanvasStore.getState().addItem({
      type: 'image', x: 0, y: 0, width: 100, height: 100,
      rotation: 0, scale: 1, locked: false, visible: true, name: 'A',
    });
    const b = useCanvasStore.getState().addItem({
      type: 'image', x: 200, y: 0, width: 100, height: 100,
      rotation: 0, scale: 1, locked: false, visible: true, name: 'B',
    });

    const anchorA = useCanvasStore.getState().anchors.find((an) => an.itemId === a.id && an.kind === 'output');
    const anchorB = useCanvasStore.getState().anchors.find((an) => an.itemId === b.id && an.kind === 'input');
    expect(anchorA).toBeTruthy();
    expect(anchorB).toBeTruthy();

    useCanvasStore.getState().startConnection(a.id, anchorA!.id, 'output');
    expect(useCanvasStore.getState().pendingConnection).toBeTruthy();

    useCanvasStore.getState().completeConnection(b.id, anchorB!.id);

    expect(useCanvasStore.getState().connections).toHaveLength(1);

    const connId = useCanvasStore.getState().connections[0].id;
    useCanvasStore.getState().removeConnection(connId);
    expect(useCanvasStore.getState().connections).toHaveLength(0);
  });

  it('moves parent with child overlay layers', () => {
    const parent = useCanvasStore.getState().addItem({
      type: 'generated', x: 100, y: 100, width: 200, height: 200,
      rotation: 0, scale: 1, locked: false, visible: true, name: 'Parent',
    });
    useCanvasStore.getState().addItem({
      type: 'drawing', x: 120, y: 130, width: 80, height: 60,
      rotation: 0, scale: 1, locked: false, visible: true, name: 'Draw',
      parentItemId: parent.id,
      layerRole: 'overlay',
      layerOffset: { x: 20, y: 30 },
    });

    useCanvasStore.getState().moveItemWithChildren(parent.id, 200, 200);

    const items = useCanvasStore.getState().items;
    const movedParent = items.find((i) => i.id === parent.id)!;
    const movedChild = items.find((i) => i.parentItemId === parent.id)!;
    expect(movedParent.x).toBe(200);
    expect(movedChild.x).toBe(220);
    expect(movedChild.y).toBe(230);
  });

  it('exports timeline hierarchy from store', () => {
    useCanvasStore.getState().addItem({
      type: 'image', x: 0, y: 0, width: 100, height: 100,
      rotation: 0, scale: 1, locked: false, visible: true, name: 'Root',
      timelineRole: 'asset',
    });
    const tree = useCanvasStore.getState().exportTimelineHierarchy();
    expect(tree).toHaveLength(1);
    expect(tree[0].timelineRole).toBe('asset');
  });

  it('focuses item in viewport', () => {
    const item = useCanvasStore.getState().addItem({
      type: 'image', x: 500, y: 400, width: 100, height: 100,
      rotation: 0, scale: 1, locked: false, visible: true, name: 'Far',
    });
    useCanvasStore.getState().focusItemInViewport(item.id, 800, 600);
    const vp = useCanvasStore.getState().viewport;
    expect(useCanvasStore.getState().selectedIds).toEqual([item.id]);
    expect(vp.x).toBeLessThan(0);
    expect(vp.y).toBeLessThan(0);
  });
});
