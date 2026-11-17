import { describe, expect, it } from 'vitest';
import { createLayer } from '../../lib/pipeline/layers';
import {
  buildLayerTree,
  descendantIds,
  duplicateLayers,
  flattenVisibleRows,
  groupLayers,
  moveLayers,
  nudgeTarget,
  outdentTarget,
  removeLayers,
  rowDropTarget,
  ungroup,
} from '../../lib/pipeline/layerTree';
import type { AssetLayer, LayerKind } from '../../types/pipeline';

// Fixed timestamps so "updatedAt was bumped" is observable (Date.now() > 1).
function L(id: string, kind: LayerKind = 'shape', parentId?: string): AssetLayer {
  const layer = createLayer(kind, { id, name: id, createdAt: 1, updatedAt: 1 });
  return parentId ? { ...layer, parentId } : layer;
}
const G = (id: string, parentId?: string) => L(id, 'group', parentId);
const ids = (layers: AssetLayer[]) => layers.map((layer) => layer.id);
const byId = (layers: AssetLayer[], id: string) => layers.find((layer) => layer.id === id)!;

/**
 * The serialisation convention: every child sits below its group, and each
 * group's subtree occupies exactly the slots right below the group's entry.
 */
function expectNormalised(layers: AssetLayer[]) {
  const position = new Map(layers.map((layer, i) => [layer.id, i]));
  for (const layer of layers) {
    if (layer.parentId && position.has(layer.parentId)) {
      expect(position.get(layer.id)!).toBeLessThan(position.get(layer.parentId)!);
    }
    if (layer.kind === 'group') {
      const inside = descendantIds(layers, layer.id);
      const at = position.get(layer.id)!;
      const slice = layers.slice(at - inside.size, at).map((item) => item.id);
      expect(new Set(slice)).toEqual(inside);
    }
  }
}

// Draw order a < x < y < g < b ; x and y live in group g.
// Display (top first): b, g, y, x, a.
function sample(): AssetLayer[] {
  return [L('a'), L('x', 'shape', 'g'), L('y', 'text', 'g'), G('g'), L('b')];
}

describe('buildLayerTree / flattenVisibleRows', () => {
  it('lists roots and children top first with depth', () => {
    const tree = buildLayerTree(sample());
    expect(tree.map((node) => node.layer.id)).toEqual(['b', 'g', 'a']);
    const group = tree[1];
    expect(group.children.map((node) => node.layer.id)).toEqual(['y', 'x']);
    expect(group.children.every((node) => node.depth === 1)).toBe(true);
    expect(tree[0].children).toEqual([]);
  });

  it('flattens visible rows and skips children of collapsed groups', () => {
    const layers = sample();
    const rows = flattenVisibleRows(buildLayerTree(layers));
    expect(rows.map((row) => row.layer.id)).toEqual(['b', 'g', 'y', 'x', 'a']);
    const y = rows[2];
    expect(y).toMatchObject({ parentId: 'g', depth: 1, indexInParent: 0, siblingCount: 2, hasChildren: false });
    expect(rows[1]).toMatchObject({ parentId: undefined, indexInParent: 1, siblingCount: 3, hasChildren: true });

    const folded = layers.map((layer) => (layer.id === 'g' ? { ...layer, collapsed: true } : layer));
    expect(flattenVisibleRows(buildLayerTree(folded)).map((row) => row.layer.id)).toEqual(['b', 'g', 'a']);
    // The override wins over the stored flag, both ways.
    expect(flattenVisibleRows(buildLayerTree(layers), { g: true }).map((row) => row.layer.id)).toEqual(['b', 'g', 'a']);
    expect(flattenVisibleRows(buildLayerTree(folded), { g: false })).toHaveLength(5);
  });

  it('treats orphans (missing or non-group parent) as root layers', () => {
    const layers = [L('a'), L('lost', 'shape', 'nowhere'), L('odd', 'shape', 'a')];
    const tree = buildLayerTree(layers);
    expect(tree.map((node) => node.layer.id)).toEqual(['odd', 'lost', 'a']);
    expect(tree.every((node) => node.depth === 0)).toBe(true);
  });

  it('collects descendants at every depth', () => {
    const layers = [L('x', 'shape', 'inner'), G('inner', 'outer'), L('y', 'shape', 'outer'), G('outer')];
    expect(descendantIds(layers, 'outer')).toEqual(new Set(['x', 'inner', 'y']));
    expect(descendantIds(layers, 'x')).toEqual(new Set());
  });
});

describe('moveLayers', () => {
  it('moves up and down at root using the display index', () => {
    const layers = [L('a'), L('b'), L('c')]; // display c, b, a
    expect(ids(moveLayers(layers, ['a'], { parentId: undefined, index: 0 }))).toEqual(['b', 'c', 'a']);
    expect(ids(moveLayers(layers, ['c'], { parentId: undefined, index: 2 }))).toEqual(['c', 'a', 'b']);
  });

  it('honours the index (would fail if the index were ignored)', () => {
    const layers = [L('a'), L('b'), L('c')];
    const toTop = moveLayers(layers, ['a'], { parentId: undefined, index: 0 });
    const toMiddle = moveLayers(layers, ['a'], { parentId: undefined, index: 1 });
    expect(ids(toTop)).toEqual(['b', 'c', 'a']);
    expect(ids(toMiddle)).toEqual(['b', 'a', 'c']);
    // Out-of-range indexes clamp instead of throwing.
    expect(ids(moveLayers(layers, ['c'], { parentId: undefined, index: 99 }))).toEqual(['c', 'a', 'b']);
  });

  it('bumps updatedAt only on the moved layer and returns the same array for a no-op', () => {
    const layers = sample();
    const next = moveLayers(layers, ['a'], { parentId: undefined, index: 0 });
    expect(byId(next, 'a').updatedAt).toBeGreaterThan(1);
    expect(byId(next, 'b')).toBe(byId(layers, 'b'));
    expect(byId(next, 'x')).toBe(byId(layers, 'x'));
    expect(moveLayers(layers, ['b'], { parentId: undefined, index: 0 })).toBe(layers);
  });

  it('moves a layer into a group and back out of it', () => {
    const layers = [L('a'), L('x', 'shape', 'g'), G('g'), L('b')];
    const inside = moveLayers(layers, ['b'], { parentId: 'g', index: 0 });
    expect(ids(inside)).toEqual(['a', 'x', 'b', 'g']);
    expect(byId(inside, 'b').parentId).toBe('g');
    expectNormalised(inside);

    const outside = moveLayers(layers, ['x'], { parentId: undefined, index: 0 });
    expect(ids(outside)).toEqual(['a', 'g', 'b', 'x']);
    expect('parentId' in byId(outside, 'x')).toBe(false);
    expectNormalised(outside);
  });

  it('carries a group\'s children, in order, when the group moves', () => {
    const layers = sample();
    const next = moveLayers(layers, ['g'], { parentId: undefined, index: 2 }); // to the bottom
    expect(ids(next)).toEqual(['x', 'y', 'g', 'a', 'b']);
    expect(byId(next, 'x').parentId).toBe('g');
    expect(byId(next, 'y').parentId).toBe('g');
    expectNormalised(next);

    const nested = moveLayers([...layers, G('h')], ['g'], { parentId: 'h', index: 0 });
    expect(ids(nested)).toEqual(['a', 'b', 'x', 'y', 'g', 'h']);
    expect(byId(nested, 'g').parentId).toBe('h');
    expect(byId(nested, 'x').parentId).toBe('g');
    expectNormalised(nested);
  });

  it('refuses a group into itself, a descendant, a non-group or a missing parent', () => {
    const layers = [L('x', 'shape', 'g2'), G('g2', 'g'), G('g'), L('a')];
    expect(moveLayers(layers, ['g'], { parentId: 'g', index: 0 })).toBe(layers);
    expect(moveLayers(layers, ['g'], { parentId: 'g2', index: 0 })).toBe(layers);
    expect(moveLayers(layers, ['a'], { parentId: 'x', index: 0 })).toBe(layers);
    expect(moveLayers(layers, ['a'], { parentId: 'ghost', index: 0 })).toBe(layers);
    expect(moveLayers(layers, ['ghost'], { parentId: undefined, index: 0 })).toBe(layers);
  });

  it('keeps the relative order of several moved layers, whatever order the ids come in', () => {
    const layers = [L('a'), L('b'), L('c'), L('d')]; // display d, c, b, a
    const expected = ['b', 'd', 'a', 'c']; // display c, a, d, b
    expect(ids(moveLayers(layers, ['a', 'c'], { parentId: undefined, index: 0 }))).toEqual(expected);
    expect(ids(moveLayers(layers, ['c', 'a'], { parentId: undefined, index: 0 }))).toEqual(expected);
  });

  it('moves a child together with its group only once', () => {
    const layers = sample();
    const next = moveLayers(layers, ['g', 'x'], { parentId: undefined, index: 0 });
    expect(ids(next)).toEqual(['a', 'b', 'x', 'y', 'g']);
    expect(byId(next, 'x').parentId).toBe('g');
  });
});

describe('duplicate / remove', () => {
  it('deep-copies a group with fresh ids and remapped parents, right above the original', () => {
    let n = 0;
    const makeId = () => `n${++n}`;
    const { layers: next, newIds } = duplicateLayers(sample(), ['g'], makeId, 42);
    expect(newIds).toEqual(['n1']);
    expect(ids(next)).toEqual(['a', 'x', 'y', 'g', 'n2', 'n3', 'n1', 'b']);
    expect(byId(next, 'n1')).toMatchObject({ kind: 'group', name: 'g copy', createdAt: 42, updatedAt: 42 });
    expect(byId(next, 'n2')).toMatchObject({ parentId: 'n1', name: 'x' });
    expect(byId(next, 'n3')).toMatchObject({ parentId: 'n1', name: 'y' });
    expect(byId(next, 'x').parentId).toBe('g');
    expectNormalised(next);
  });

  it('copies a nested layer into the same group, directly above it', () => {
    let n = 0;
    const { layers: next, newIds } = duplicateLayers(sample(), ['x'], () => `c${++n}`, 5);
    expect(newIds).toEqual(['c1']);
    expect(ids(next)).toEqual(['a', 'x', 'c1', 'y', 'g', 'b']);
    expect(byId(next, 'c1')).toMatchObject({ parentId: 'g', name: 'x copy' });
  });

  it('does not copy a child twice when its group is also selected', () => {
    let n = 0;
    const { layers: next } = duplicateLayers(sample(), ['x', 'g'], () => `d${++n}`, 5);
    expect(next).toHaveLength(8);
  });

  it('removes a whole subtree and leaves unknown ids alone', () => {
    const layers = sample();
    expect(ids(removeLayers(layers, ['g']))).toEqual(['a', 'b']);
    expect(ids(removeLayers(layers, ['x', 'b']))).toEqual(['a', 'y', 'g']);
    expect(removeLayers(layers, ['ghost'])).toBe(layers);
  });
});

describe('group / ungroup', () => {
  it('nests a group inside a new group at the topmost member\'s place', () => {
    const next = groupLayers(sample(), ['g', 'b'], G('h'));
    expect(ids(next)).toEqual(['a', 'x', 'y', 'g', 'b', 'h']);
    expect(byId(next, 'g').parentId).toBe('h');
    expect(byId(next, 'b').parentId).toBe('h');
    expect('parentId' in byId(next, 'h')).toBe(false);
    expectNormalised(next);
  });

  it('groups siblings inside their own group, and mixed parents under the topmost one', () => {
    const inner = groupLayers(sample(), ['x', 'y'], G('k'));
    expect(ids(inner)).toEqual(['a', 'x', 'y', 'k', 'g', 'b']);
    expect(byId(inner, 'k').parentId).toBe('g');
    expect(byId(inner, 'x').parentId).toBe('k');
    expectNormalised(inner);

    const mixed = groupLayers(sample(), ['a', 'y'], G('m'));
    expect(ids(mixed)).toEqual(['x', 'a', 'y', 'm', 'g', 'b']);
    expect(byId(mixed, 'm').parentId).toBe('g');
    expect(byId(mixed, 'a').parentId).toBe('m');
    expectNormalised(mixed);
  });

  it('groups a single layer and refuses an empty selection', () => {
    const layers = sample();
    expect(ids(groupLayers(layers, ['b'], G('s')))).toEqual(['a', 'x', 'y', 'g', 'b', 's']);
    expect(groupLayers(layers, [], G('s'))).toBe(layers);
    expect(groupLayers(layers, ['ghost'], G('s'))).toBe(layers);
  });

  it('ungroups into the group\'s own parent at the group\'s position', () => {
    // g holds p, g2 (holding x, y) and q.
    const layers = [
      L('a'), L('p', 'shape', 'g'), L('x', 'shape', 'g2'), L('y', 'shape', 'g2'),
      G('g2', 'g'), L('q', 'shape', 'g'), G('g'), L('b'),
    ];
    const next = ungroup(layers, 'g2');
    expect(ids(next)).toEqual(['a', 'p', 'x', 'y', 'q', 'g', 'b']);
    expect(byId(next, 'x').parentId).toBe('g');
    expect(byId(next, 'y').parentId).toBe('g');
    expectNormalised(next);

    const flat = ungroup(next, 'g');
    expect(ids(flat)).toEqual(['a', 'p', 'x', 'y', 'q', 'b']);
    expect(flat.every((layer) => !layer.parentId)).toBe(true);
    expect(ungroup(layers, 'a')).toBe(layers);
  });
});

describe('list targets', () => {
  const layers = sample();
  const rows = flattenVisibleRows(buildLayerTree(layers)); // b, g, y, x, a
  const row = (id: string) => rows.find((item) => item.layer.id === id)!;

  it('maps the pointer position on a row to before / into / after', () => {
    expect(rowDropTarget(row('a'), 0.2, rows)).toMatchObject({ parentId: undefined, index: 2, zone: 'before' });
    expect(rowDropTarget(row('a'), 0.8, rows)).toMatchObject({ parentId: undefined, index: 3, zone: 'after' });
    expect(rowDropTarget(row('g'), 0.5, rows)).toMatchObject({ parentId: 'g', index: 0, zone: 'into' });
    expect(rowDropTarget(row('g'), 0.1, rows)).toMatchObject({ parentId: undefined, index: 1, zone: 'before' });
    // Under an open group the line sits above its first child: "into, at the top".
    expect(rowDropTarget(row('g'), 0.9, rows)).toMatchObject({ parentId: 'g', index: 0 });
    expect(rowDropTarget(row('x'), 0.8, rows)).toMatchObject({ parentId: 'g', index: 2 });

    const folded = flattenVisibleRows(buildLayerTree(layers), { g: true });
    const g = folded.find((item) => item.layer.id === 'g')!;
    expect(rowDropTarget(g, 0.9, folded)).toMatchObject({ parentId: undefined, index: 2, zone: 'after' });
  });

  it('discounts the dragged rows and the result feeds moveLayers', () => {
    const target = rowDropTarget(row('a'), 0.8, rows, ['b'])!;
    expect(target).toMatchObject({ parentId: undefined, index: 2 });
    expect(ids(moveLayers(layers, ['b'], target))).toEqual(['b', 'a', 'x', 'y', 'g']);
  });

  it('refuses dropping a group onto itself or inside itself', () => {
    expect(rowDropTarget(row('g'), 0.5, rows, ['g'])).toBeNull();
    expect(rowDropTarget(row('y'), 0.2, rows, ['g'])).toBeNull();
  });

  it('nudges one step and moves out of a group above it', () => {
    const flat = [L('a'), L('b'), L('c')];
    const up = nudgeTarget(flat, ['a'], 'up')!;
    expect(ids(moveLayers(flat, ['a'], up))).toEqual(['b', 'a', 'c']);
    expect(nudgeTarget(flat, ['c'], 'up')).toBeNull();
    expect(nudgeTarget(flat, ['a'], 'down')).toBeNull();
    const down = nudgeTarget(flat, ['c'], 'down')!;
    expect(ids(moveLayers(flat, ['c'], down))).toEqual(['a', 'c', 'b']);

    const out = outdentTarget(layers, ['x'])!;
    expect(out).toEqual({ parentId: undefined, index: 1 });
    expect(ids(moveLayers(layers, ['x'], out))).toEqual(['a', 'y', 'g', 'x', 'b']);
    expect(outdentTarget(layers, ['a'])).toBeNull();
  });
});

describe('draw-order invariant', () => {
  it('stays normalised and loses nothing across many random moves', () => {
    let layers: AssetLayer[] = [
      L('a'), L('p', 'shape', 'g'), L('x', 'shape', 'g2'), G('g2', 'g'), G('g'),
      L('b'), L('q', 'shape', 'h'), G('h'), L('c'),
    ];
    const all = new Set(ids(layers));
    // Park–Miller LCG (products stay below 2^53) so a failure is reproducible.
    let seed = 7;
    const rand = (n: number) => {
      seed = (seed * 48271) % 2147483647;
      return seed % n;
    };
    const groups = ['g', 'g2', 'h'];
    for (let step = 0; step < 300; step += 1) {
      const pool = ids(layers);
      const picked = [pool[rand(pool.length)], ...(rand(3) === 0 ? [pool[rand(pool.length)]] : [])];
      const parentChoice = rand(groups.length + 1);
      const parentId = parentChoice === groups.length ? undefined : groups[parentChoice];
      layers = moveLayers(layers, picked, { parentId, index: rand(6) });
      expect(new Set(ids(layers))).toEqual(all);
      expectNormalised(layers);
    }
  });
});
