import { afterEach, describe, expect, it } from 'vitest';
import { settleNode } from '../../components/workshop/settleNode';
import { LANE_HEADER, NODE_H, NODE_W, laneX, usePipelineStore } from '../../stores/pipelineStore';

afterEach(() => {
  usePipelineStore.getState().clearAll();
});

describe('settleNode', () => {
  it('inserts a drop onto a lane member where the pointer is, instead of appending it', () => {
    const store = usePipelineStore.getState();
    store.clearAll();
    const first = store.addNode('prompt-craft');
    const second = store.addNode('prompt-craft');
    const incoming = store.addNode('prompt-craft');
    if (!first || !second || !incoming) throw new Error('missing nodes');

    // The card covers the first member, and its center sits outside the lane frame,
    // so the lane hit-test misses and the overlap path has to place it.
    const x = laneX('script') - NODE_W + 40;
    const y = LANE_HEADER - NODE_H / 2;
    store.placeFree(incoming.id, x, y);
    store.setDragTarget(null, null);

    settleNode(incoming.id);

    const slots = new Map(usePipelineStore.getState().nodes.map((node) => [node.id, node.slot]));
    expect(slots.get(incoming.id)).toBe(0);
    expect(slots.get(first.id)).toBe(1);
    expect(slots.get(second.id)).toBe(2);
  });
});
