import type {
  CanvasConnection,
  CanvasItem,
  CanvasTimelineNode,
} from '@/types';

export function buildCanvasTimelineHierarchy(
  items: CanvasItem[],
  connections: CanvasConnection[],
): CanvasTimelineNode[] {
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const childMap = new Map<string, CanvasItem[]>();

  for (const item of items) {
    if (item.parentItemId) {
      const list = childMap.get(item.parentItemId) ?? [];
      list.push(item);
      childMap.set(item.parentItemId, list);
    }
  }

  const roots = items
    .filter((i) => !i.parentItemId)
    .sort((a, b) => (a.stackOrder ?? a.zIndex) - (b.stackOrder ?? b.zIndex));

  function buildNode(item: CanvasItem): CanvasTimelineNode {
    const children = (childMap.get(item.id) ?? [])
      .sort((a, b) => a.zIndex - b.zIndex)
      .map(buildNode);

    const itemConnections = connections
      .filter((c) => c.sourceItemId === item.id)
      .map((c) => ({
        targetId: c.targetItemId,
        kind: c.kind,
        color: c.color,
      }));

    return {
      itemId: item.id,
      name: item.name,
      type: item.type,
      layerRole: item.layerRole,
      timelineRole: item.timelineRole,
      zIndex: item.zIndex,
      stackOrder: item.stackOrder,
      parentItemId: item.parentItemId,
      promptId: item.promptId,
      lineageId: item.lineageId,
      sceneId: item.sceneId,
      children,
      connections: itemConnections,
    };
  }

  return roots.map(buildNode);
}

export function getRelatedItemIds(
  itemId: string,
  items: CanvasItem[],
  connections: CanvasConnection[],
): string[] {
  const item = items.find((i) => i.id === itemId);
  if (!item) return [];

  const related = new Set<string>();

  // Child overlay layers
  for (const i of items) {
    if (i.parentItemId === itemId) related.add(i.id);
  }

  // Parent
  if (item.parentItemId) related.add(item.parentItemId);

  // Lineage siblings via promptId
  if (item.promptId) {
    for (const i of items) {
      if (i.promptId === item.promptId && i.id !== itemId) related.add(i.id);
    }
  }

  // Generation meta parents/children
  if (item.generationMeta?.parentIds) {
    for (const pid of item.generationMeta.parentIds) related.add(pid);
  }
  if (item.generationMeta?.childIds) {
    for (const cid of item.generationMeta.childIds) related.add(cid);
  }

  // Connections
  for (const c of connections) {
    if (c.sourceItemId === itemId) related.add(c.targetItemId);
    if (c.targetItemId === itemId) related.add(c.sourceItemId);
  }

  related.delete(itemId);
  return [...related];
}
