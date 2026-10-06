import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('uuid', () => ({
  v4: () => 'id-' + Math.random().toString(36).slice(2, 8),
}));

import { usePipelineStore } from '../../stores/pipelineStore';

describe('spawnLinkedNode', () => {
  beforeEach(() => {
    usePipelineStore.setState({
      nodes: [],
      edges: [],
      pendingEdge: null,
      selectedId: null,
      openStages: [],
      collapsedStages: [],
    });
  });

  it('places a free node to the right of an output and links it', () => {
    const store = usePipelineStore.getState();
    const source = store.addNode('image-import');
    expect(source).toBeTruthy();
    store.placeFree(source!.id, 100, 80);
    const id = store.spawnLinkedNode({
      type: 'image-edit',
      newPortId: 'image',
      sourceId: source!.id,
      sourcePortId: 'image',
      sourceSide: 'out',
    });
    const next = usePipelineStore.getState();
    const created = next.nodes.find((node) => node.id === id);
    expect(created?.inLane).toBe(false);
    expect(created?.x).toBeGreaterThan(100);
    expect(created?.y).toBe(80);
    expect(next.edges).toEqual([
      expect.objectContaining({ from: source!.id, fromPort: 'image', to: id, toPort: 'image' }),
    ]);
  });

  it('places a free node to the left when the drag starts on an input', () => {
    const store = usePipelineStore.getState();
    const source = store.addNode('image-edit');
    store.placeFree(source!.id, 800, 40);
    const id = store.spawnLinkedNode({
      type: 'image-import',
      newPortId: 'image',
      sourceId: source!.id,
      sourcePortId: 'image',
      sourceSide: 'in',
    });
    const created = usePipelineStore.getState().nodes.find((node) => node.id === id);
    expect(created!.x).toBeLessThan(800);
    const edge = usePipelineStore.getState().edges[0];
    expect(edge.from).toBe(id);
    expect(edge.to).toBe(source!.id);
  });

  it('joins the source workflow plate and opens it', () => {
    const store = usePipelineStore.getState();
    const source = store.addNode('image-import');
    usePipelineStore.setState({
      nodes: usePipelineStore.getState().nodes.map((node) => ({
        ...node,
        inLane: false,
        x: 40,
        y: 70,
        clusterId: 'plate-1',
        clusterTitle: 'Remove background',
        clusterIcon: 'image-off',
        clusterCollapsed: true,
        clusterFrame: { x: 20, y: 20, w: 400, h: 280 },
      })),
    });
    const id = usePipelineStore.getState().spawnLinkedNode({
      type: 'image-edit',
      newPortId: 'image',
      sourceId: source!.id,
      sourcePortId: 'image',
      sourceSide: 'out',
    });
    const nodes = usePipelineStore.getState().nodes.filter((node) => node.clusterId === 'plate-1');
    expect(nodes).toHaveLength(2);
    expect(nodes.every((node) => node.clusterCollapsed === false)).toBe(true);
    expect(nodes.every((node) => node.clusterTitle === 'Remove background')).toBe(true);
    expect(nodes.find((node) => node.id === id)?.clusterFrame?.w).toBeGreaterThan(400);
  });

  it('refuses a port that cannot carry the wire', () => {
    const store = usePipelineStore.getState();
    const source = store.addNode('audio-import');
    store.placeFree(source!.id, 10, 10);
    const id = store.spawnLinkedNode({
      type: 'image-edit',
      newPortId: 'image',
      sourceId: source!.id,
      sourcePortId: 'audio',
      sourceSide: 'out',
    });
    expect(id).toBeNull();
    expect(usePipelineStore.getState().nodes).toHaveLength(1);
  });
});
