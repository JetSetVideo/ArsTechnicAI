import { NODE_H, NODE_W, nodePosition, usePipelineStore } from '@/stores/pipelineStore';
import { rectsOverlap, stageAtPoint } from '@/lib/pipeline/lanes';
import { visibleLaneFrames } from './laneFrames';

/** After a drag or a drop, join the lane under the card, group two pictures, or stay free. */
export function settleNode(id: string): void {
  const store = usePipelineStore.getState();
  const self = store.nodes.find((item) => item.id === id);
  if (!self || self.x === undefined || self.y === undefined) return;
  const frames = visibleLaneFrames(store.nodes, store.collapsedStages);
  const stage = stageAtPoint(self.x + NODE_W / 2, self.y + NODE_H / 2, frames);
  if (stage) {
    if (self.stage === stage && self.inLane !== false) store.resetNodePosition(id);
    else store.joinLane(id, stage);
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
    return;
  }
  if (hit && self.type === 'image-import' && hit.type === 'image-import') {
    store.joinLane(hit.id, 'concept');
    store.joinLane(id, 'concept');
    return;
  }
  store.placeFree(id, self.x, self.y);
  store.releaseSparseMoodboard();
}
