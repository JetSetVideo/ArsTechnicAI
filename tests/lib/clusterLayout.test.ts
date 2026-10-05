import { describe, expect, it } from 'vitest';
import {
  CLUSTER_GAP_MIN_X,
  CLUSTER_GAP_X,
  CLUSTER_PAD_X,
  CLUSTER_PAD_TOP,
  findClusterOrigin,
  minClusterSize,
  packCluster,
  placeCluster,
  resizeClusterFrame,
} from '../../lib/pipeline/clusterLayout';
import { NODE_W } from '../../stores/pipelineStore';

describe('workflow cluster layout', () => {
  it('sets a two-step workflow side by side with room to grab the wire', () => {
    const packed = packCluster(['src', 'edit'], [{ from: 'src', to: 'edit' }]);
    const src = packed.positions.get('src');
    const edit = packed.positions.get('edit');
    expect(src).toEqual({ x: CLUSTER_PAD_X, y: CLUSTER_PAD_TOP });
    expect(edit?.x).toBe(CLUSTER_PAD_X + NODE_W + CLUSTER_GAP_X);
    expect(edit?.y).toBe(src?.y);
    expect(CLUSTER_GAP_X).toBeGreaterThan(CLUSTER_GAP_MIN_X);
    expect(CLUSTER_GAP_X).toBeGreaterThanOrEqual(44);
    expect(CLUSTER_PAD_X).toBeLessThan(24);
  });

  it('spreads cards when the plate grows and stops at the minimum gap', () => {
    const edges = [{ from: 'src', to: 'edit' }];
    const min = minClusterSize(['src', 'edit'], edges);
    const tight = placeCluster(['src', 'edit'], edges, { x: 0, y: 0, w: min.w, h: min.h });
    const src = tight.get('src');
    const edit = tight.get('edit');
    expect(edit && src ? edit.x - src.x - NODE_W : 0).toBeCloseTo(CLUSTER_GAP_MIN_X);
    const wide = placeCluster(['src', 'edit'], edges, { x: 10, y: 20, w: min.w + 80, h: min.h });
    const left = wide.get('src');
    const right = wide.get('edit');
    expect(left).toMatchObject({ x: 10 + CLUSTER_PAD_X, y: 20 + CLUSTER_PAD_TOP });
    expect(right && left ? right.x - left.x - NODE_W : 0).toBeCloseTo(CLUSTER_GAP_MIN_X + 80);
    const shrunk = resizeClusterFrame(
      { x: 10, y: 20, w: min.w + 80, h: min.h + 40 },
      'w',
      500,
      0,
      min,
    );
    expect(shrunk.w).toBe(min.w);
    expect(shrunk.x).toBe(10 + 80);
  });

  it('centers the plate on the point in view when that spot is open', () => {
    const origin = findClusterOrigin({ x: 400, y: 300 }, 200, 100, []);
    expect(origin).toEqual({ x: 300, y: 250 });
  });

  it('steps off a spot that already holds nodes and stays near the view', () => {
    const width = 200;
    const height = 100;
    const blocked = findClusterOrigin({ x: 400, y: 300 }, width, height, [
      { x: 280, y: 230, w: 240, h: 140 },
    ], { x: 0, y: 0, w: 900, h: 700 });
    const frame = { x: blocked.x, y: blocked.y, w: width, h: height };
    const overlaps = frame.x < 520 && frame.x + frame.w > 280 && frame.y < 370 && frame.y + frame.h > 230;
    expect(overlaps).toBe(false);
    expect(Math.abs(blocked.x + width / 2 - 400) + Math.abs(blocked.y + height / 2 - 300)).toBeLessThan(500);
  });
});
