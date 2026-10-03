import { LANE_HEADER, NODE_GAP, NODE_H, NODE_W, nodePosition, usePipelineStore } from '@/stores/pipelineStore';
import { insertionIndex, laneMembers, rectsOverlap, stageAtPoint } from '@/lib/pipeline/lanes';
import { visibleLaneFrames } from './laneFrames';

/** After a drag or a drop, insert into the lane under the card, group two pictures, or stay free. */
export function settleNode(id: string): void {
  const store = usePipelineStore.getState();
  const self = store.nodes.find((item) => item.id === id);
  let stage = store.dragOverStage;
  let index = store.dragInsertIndex;
  store.setDragTarget(null, null);
  store.setDraggingNode(null);
  if (!self || self.x === undefined || self.y === undefined) return;

  if (stage == null) {
    const frames = visibleLaneFrames(store.nodes, {
      collapsed: store.collapsedStages,
      pinned: store.openStages,
      excludeId: id,
    });
    stage = stageAtPoint(self.x + NODE_W / 2, self.y + NODE_H / 2, frames, NODE_H * 0.35);
    if (stage) {
      const count = laneMembers(store.nodes.filter((node) => node.id !== id), stage).length;
      index = insertionIndex(self.y + NODE_H / 2, count, LANE_HEADER, NODE_H, NODE_GAP);
    }
  }

  if (stage != null && index != null) {
    store.joinLane(id, stage, index);
    store.releaseSparseMoodboard();
    return;
  }

  const card = { x: self.x, y: self.y, w: NODE_W, h: NODE_H };
  const hit = store.nodes.find((other) => {
    if (other.id === self.id) return false;
    const at = nodePosition(other);
    return rectsOverlap(card, { x: at.x, y: at.y, w: NODE_W, h: NODE_H });
  });
  if (hit && hit.inLane !== false) {
    store.joinLane(id, hit.stage);
    store.releaseSparseMoodboard();
    return;
  }
  if (hit && self.type === 'image-import' && hit.type === 'image-import') {
    store.joinLane(hit.id, 'concept');
    store.joinLane(id, 'concept');
    store.releaseSparseMoodboard();
    return;
  }
  store.placeFree(id, self.x, self.y);
  store.releaseSparseMoodboard();
}
