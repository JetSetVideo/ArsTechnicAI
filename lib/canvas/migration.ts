import { v4 as uuidv4 } from 'uuid';
import type { CanvasAnchor, CanvasGroup, CanvasGraphState, CanvasItem } from '@/types';
import { getDefaultAnchorsForItem } from './anchors';

export interface LegacyCanvasPayload {
  items?: CanvasItem[];
  groups?: CanvasGroup[];
  connections?: CanvasGraphState['connections'];
  anchors?: CanvasAnchor[];
}

export function migrateCanvasPayload(payload: LegacyCanvasPayload): {
  items: CanvasItem[];
  groups: CanvasGroup[];
  connections: CanvasGraphState['connections'];
  anchors: CanvasAnchor[];
} {
  const items = (payload.items ?? []).map(normalizeCanvasItem);
  let groups = payload.groups ?? [];
  const connections = payload.connections ?? [];
  let anchors = payload.anchors ?? [];

  // Migrate legacy groupId fields into group registry
  const legacyGroupIds = new Set(
    items.filter((i) => i.groupId).map((i) => i.groupId as string),
  );

  if (legacyGroupIds.size > 0 && groups.length === 0) {
    groups = [...legacyGroupIds].map((gid) => {
      const members = items.filter((i) => i.groupId === gid);
      const orbit = members.some((m) => m.groupOrbit);
      return {
        id: gid,
        name: 'Group',
        itemIds: members.map((m) => m.id),
        collapsed: false,
        orbit,
        stackOrder: 0,
        createdAt: Date.now(),
      };
    });
  }

  // Ensure anchors exist for all items
  const anchorItemIds = new Set(anchors.map((a) => a.itemId));
  for (const item of items) {
    if (!anchorItemIds.has(item.id)) {
      anchors = [...anchors, ...getDefaultAnchorsForItem(item)];
    }
  }

  // Default etiquette positions
  const migratedItems = items.map((item) => ({
    ...item,
    etiquettePosition: item.etiquettePosition ?? { x: 0, y: -28 },
    timelineRole: item.timelineRole ?? inferTimelineRole(item),
    layerRole: item.layerRole ?? inferLayerRole(item),
  }));

  return { items: migratedItems, groups, connections, anchors };
}

function normalizeCanvasItem(item: CanvasItem): CanvasItem {
  const type = item.type === 'shape' || item.type === 'drawing'
    ? item.type
    : item.type;

  let overlayKind = item.overlayKind;
  if (!overlayKind && item.name === 'Draw Layer') overlayKind = 'pen';
  if (!overlayKind && item.name === 'Shape Layer') overlayKind = 'shape';
  if (!overlayKind && item.type === 'text') overlayKind = 'text';

  return {
    ...item,
    type,
    overlayKind,
    connectionIds: item.connectionIds ?? [],
  };
}

function inferLayerRole(item: CanvasItem): CanvasItem['layerRole'] {
  if (item.parentItemId) return 'overlay';
  if (item.generationMeta || item.type === 'generated') return 'generated';
  if (item.promptId && !item.generationMeta) return 'prompt';
  if (item.generationMeta?.parentIds?.length) return 'variant';
  return 'base';
}

function inferTimelineRole(item: CanvasItem): CanvasItem['timelineRole'] {
  if (item.parentItemId) return 'overlay';
  if (item.type === 'video' || item.type === 'audio') return 'asset';
  return 'asset';
}

export function findParentItemAtPoint(
  items: CanvasItem[],
  x: number,
  y: number,
  excludeId?: string,
): CanvasItem | undefined {
  const candidates = items
    .filter((i) => i.id !== excludeId && !i.parentItemId && i.visible)
    .filter((i) => ['image', 'generated', 'video'].includes(i.type))
    .sort((a, b) => b.zIndex - a.zIndex);

  for (const item of candidates) {
    const w = item.width * item.scale;
    const h = item.height * item.scale;
    if (x >= item.x && x <= item.x + w && y >= item.y && y <= item.y + h) {
      return item;
    }
  }
  return undefined;
}

export function attachOverlayToParent(
  overlay: CanvasItem,
  parent: CanvasItem,
): Partial<CanvasItem> {
  return {
    parentItemId: parent.id,
    layerRole: 'overlay',
    layerOffset: {
      x: overlay.x - parent.x,
      y: overlay.y - parent.y,
      scale: overlay.scale,
      rotation: overlay.rotation,
    },
    lineageId: parent.lineageId ?? overlay.lineageId,
    promptId: parent.promptId ?? overlay.promptId,
  };
}
