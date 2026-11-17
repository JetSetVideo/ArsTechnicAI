import { describe, expect, it } from 'vitest';
import {
  groupIntoPlate, nextGroupTitle, removeFromPlates, renamePlate, sharedPlate, ungroupPlate,
} from '../../lib/pipeline/nodeGroups';
import { NODE_H, NODE_W, nodePosition } from '../../stores/pipelineStore';
import type { PipelineNode } from '../../types/pipeline';

function node(id: string, extra: Partial<PipelineNode> = {}): PipelineNode {
  return {
    id,
    type: 'prompt-lab',
    title: id.toUpperCase(),
    stage: 'script',
    slot: 0,
    params: {},
    variants: [],
    status: 'idle',
    ...extra,
  } as PipelineNode;
}

const rectsOverlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe('groupIntoPlate', () => {
  it('wraps free cards in a plate without moving them', () => {
    const nodes = [node('a', { inLane: false, x: 100, y: 100 }), node('b', { inLane: false, x: 500, y: 140 }), node('c', { inLane: false, x: 2000, y: 0 })];
    const out = groupIntoPlate(nodes, ['a', 'b'], { clusterId: 'g1', title: 'Group 1', edges: [] });
    const a = out.find((n) => n.id === 'a')!;
    const b = out.find((n) => n.id === 'b')!;
    expect([a.x, a.y, b.x, b.y]).toEqual([100, 100, 500, 140]);
    expect(a.clusterId).toBe('g1');
    expect(b.clusterTitle).toBe('Group 1');
    expect(a.clusterFrame).toBe(b.clusterFrame);
    // The plate contains both cards.
    const frame = a.clusterFrame!;
    for (const card of [a, b]) {
      expect(card.x!).toBeGreaterThanOrEqual(frame.x);
      expect(card.y!).toBeGreaterThanOrEqual(frame.y);
      expect(card.x! + NODE_W).toBeLessThanOrEqual(frame.x + frame.w);
      expect(card.y! + NODE_H).toBeLessThanOrEqual(frame.y + frame.h);
    }
    expect(out.find((n) => n.id === 'c')!.clusterId).toBeUndefined();
  });

  it('lifts lane cards out of their lanes and places the plate clear of the remaining cards', () => {
    const nodes = [
      node('a', { stage: 'script', slot: 0 }),
      node('b', { stage: 'script', slot: 1 }),
      node('c', { stage: 'script', slot: 2 }),
      node('d', { stage: 'concept', slot: 0 }),
    ];
    // compact: renumber what is still in a lane (stand-in for the store's compactInLane)
    const compact = (list: PipelineNode[]) => {
      const lanes = new Map<string, PipelineNode[]>();
      for (const item of list) if (item.inLane !== false) lanes.set(item.stage, [...(lanes.get(item.stage) ?? []), item]);
      return list.map((item) => {
        if (item.inLane === false) return item;
        const slot = lanes.get(item.stage)!.sort((p, q) => p.slot - q.slot).indexOf(item);
        return { ...item, slot };
      });
    };
    const out = groupIntoPlate(nodes, ['a', 'b'], { clusterId: 'g', title: 'Edits', edges: [{ from: 'a', to: 'b' }], compact });
    const a = out.find((n) => n.id === 'a')!;
    const c = out.find((n) => n.id === 'c')!;
    expect(a.inLane).toBe(false);
    expect(c.slot).toBe(0); // the lane closed up
    const frame = a.clusterFrame!;
    for (const other of out.filter((n) => !n.clusterId)) {
      const at = nodePosition(other);
      expect(rectsOverlap(frame, { x: at.x, y: at.y, w: NODE_W, h: NODE_H })).toBe(false);
    }
  });

  it('ignores unknown ids and returns the same array when nothing is grouped', () => {
    const nodes = [node('a')];
    expect(groupIntoPlate(nodes, ['zzz'], { clusterId: 'g', title: 'x', edges: [] })).toBe(nodes);
  });

  it('moves a card out of its old plate into the new one', () => {
    const nodes = [
      node('a', { inLane: false, x: 0, y: 0, clusterId: 'old', clusterTitle: 'Old' }),
      node('b', { inLane: false, x: 400, y: 0, clusterId: 'old', clusterTitle: 'Old' }),
    ];
    const out = groupIntoPlate(nodes, ['a'], { clusterId: 'new', title: 'New', edges: [] });
    expect(out.find((n) => n.id === 'a')!.clusterId).toBe('new');
    expect(out.find((n) => n.id === 'b')!.clusterId).toBe('old');
  });
});

describe('ungroup, remove, rename', () => {
  const grouped = [
    node('a', { inLane: false, x: 10, y: 20, clusterId: 'g', clusterTitle: 'G', clusterFrame: { x: 0, y: 0, w: 1, h: 1 }, clusterCollapsed: true }),
    node('b', { inLane: false, x: 400, y: 20, clusterId: 'g', clusterTitle: 'G' }),
  ];

  it('ungroup keeps every card where it is and clears the plate', () => {
    const out = ungroupPlate(grouped, 'g');
    expect(out.map((n) => [n.x, n.y, n.clusterId, n.clusterFrame, n.clusterCollapsed])).toEqual([
      [10, 20, undefined, undefined, undefined],
      [400, 20, undefined, undefined, undefined],
    ]);
    expect(ungroupPlate(grouped, 'missing')).toBe(grouped);
  });

  it('removes only the chosen cards from the plate', () => {
    const out = removeFromPlates(grouped, ['b']);
    expect(out.find((n) => n.id === 'a')!.clusterId).toBe('g');
    expect(out.find((n) => n.id === 'b')!.clusterId).toBeUndefined();
  });

  it('renames every member and refuses an empty name', () => {
    expect(renamePlate(grouped, 'g', '  Hero shots ').every((n) => n.clusterTitle === 'Hero shots')).toBe(true);
    expect(renamePlate(grouped, 'g', '   ')).toBe(grouped);
  });

  it('knows when a selection shares one plate', () => {
    expect(sharedPlate(grouped, ['a', 'b'])).toBe('g');
    expect(sharedPlate([...grouped, node('c')], ['a', 'c'])).toBeNull();
  });

  it('numbers default titles without clashing', () => {
    expect(nextGroupTitle([node('x', { clusterTitle: 'Group 1' })])).toBe('Group 2');
  });
});
