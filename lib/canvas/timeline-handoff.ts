/**
 * Timeline handoff — converts canvas hierarchy to assembly-ready structure.
 */
export { buildCanvasTimelineHierarchy, getRelatedItemIds } from './hierarchy';
export type { CanvasTimelineNode } from '@/types';

import type { CanvasItem, CanvasConnection } from '@/types';
import { buildCanvasTimelineHierarchy } from './hierarchy';

export interface TimelineHandoffPayload {
  hierarchy: ReturnType<typeof buildCanvasTimelineHierarchy>;
  sceneItems: { sceneId?: string; itemIds: string[] }[];
  exportedAt: number;
}

export function exportTimelineHandoff(
  items: CanvasItem[],
  connections: CanvasConnection[],
): TimelineHandoffPayload {
  const hierarchy = buildCanvasTimelineHierarchy(items, connections);
  const sceneMap = new Map<string, string[]>();

  for (const item of items) {
    if (item.sceneId) {
      const list = sceneMap.get(item.sceneId) ?? [];
      list.push(item.id);
      sceneMap.set(item.sceneId, list);
    }
  }

  return {
    hierarchy,
    sceneItems: [...sceneMap.entries()].map(([sceneId, itemIds]) => ({ sceneId, itemIds })),
    exportedAt: Date.now(),
  };
}
