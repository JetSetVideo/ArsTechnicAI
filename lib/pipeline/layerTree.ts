// ─────────────────────────────────────────────────────────────────────────────
// Layer tree — pure operations over a variant's flat layer array.
//
// The model stays flat (`variant.layers`, index 0 = bottom, last = top) and
// nests by `parentId`. Every operation here works on a derived tree and then
// re-serialises it with one convention, so the array is always "normalised":
//   • for every parent, its children appear in bottom → top order;
//   • a group's own entry sits immediately AFTER (above) its whole subtree.
// Display order (the layers list) is the reverse: top first.
// Framework-free and client-safe; covered by tests/lib/layerTree.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

import type { AssetLayer } from '@/types/pipeline';

export interface LayerTreeNode {
  layer: AssetLayer;
  depth: number;
  /** Top-first (display order). Empty for non-groups. */
  children: LayerTreeNode[];
}

export interface LayerRow {
  layer: AssetLayer;
  depth: number;
  /** Effective parent (undefined at root, also for orphans). */
  parentId: string | undefined;
  /** Display index among the parent's children (0 = top). */
  indexInParent: number;
  siblingCount: number;
  hasChildren: boolean;
}

export interface MoveTarget {
  parentId: string | undefined;
  /** Display index (0 = top) among the target parent's children AFTER the moved layers are removed. */
  index: number;
}

export interface DropTarget extends MoveTarget {
  /** Where the indicator goes relative to the hovered row. */
  zone: 'before' | 'into' | 'after';
  /** Indentation depth for the drop line. */
  depth: number;
}

// Key for the root bucket in the children map. A real id never contains NUL.
const ROOT = '\u0000root';
const keyOf = (parentId: string | undefined) => (parentId === undefined ? ROOT : parentId);

interface LayerIndex {
  byId: Map<string, AssetLayer>;
  /** Effective parent: a real, existing group; otherwise undefined (root). */
  parentOf: Map<string, string | undefined>;
  /** Parent key → child ids, bottom → top. */
  kids: Map<string, string[]>;
}

function indexLayers(layers: AssetLayer[]): LayerIndex {
  const byId = new Map<string, AssetLayer>();
  for (const layer of layers) if (!byId.has(layer.id)) byId.set(layer.id, layer);

  const parentOf = new Map<string, string | undefined>();
  for (const layer of byId.values()) {
    const parent = layer.parentId !== undefined ? byId.get(layer.parentId) : undefined;
    // Orphans (missing parent, or a parent that is not a group) are treated as root.
    parentOf.set(layer.id, parent && parent.kind === 'group' && parent.id !== layer.id ? parent.id : undefined);
  }

  // Break parent cycles (corrupt data) at the node that closes the loop, so the
  // rest of the chain keeps its structure and recursion below always ends.
  for (const id of byId.keys()) {
    const path = [id];
    const seen = new Set(path);
    let parent = parentOf.get(id);
    while (parent !== undefined) {
      if (seen.has(parent)) {
        parentOf.set(path[path.length - 1], undefined);
        break;
      }
      seen.add(parent);
      path.push(parent);
      parent = parentOf.get(parent);
    }
  }

  const kids = new Map<string, string[]>([[ROOT, []]]);
  const placed = new Set<string>();
  for (const layer of layers) {
    if (placed.has(layer.id)) continue;
    placed.add(layer.id);
    const key = keyOf(parentOf.get(layer.id));
    const list = kids.get(key);
    if (list) list.push(layer.id);
    else kids.set(key, [layer.id]);
  }
  for (const layer of byId.values()) {
    if (layer.kind === 'group' && !kids.has(layer.id)) kids.set(layer.id, []);
  }
  return { byId, parentOf, kids };
}

function cloneKids(kids: Map<string, string[]>): Map<string, string[]> {
  return new Map([...kids].map(([key, list]) => [key, [...list]]));
}

function serialize(kids: Map<string, string[]>, byId: Map<string, AssetLayer>): AssetLayer[] {
  const out: AssetLayer[] = [];
  const visit = (key: string) => {
    for (const id of kids.get(key) ?? []) {
      const layer = byId.get(id);
      if (!layer) continue;
      if (layer.kind === 'group') visit(id);
      out.push(layer);
    }
  };
  visit(ROOT);
  return out;
}

/** Position of each id in the normalised (bottom → top) order. */
function drawOrder(index: LayerIndex): Map<string, number> {
  return new Map(serialize(index.kids, index.byId).map((layer, i) => [layer.id, i]));
}

function ancestorsOf(index: LayerIndex, id: string): string[] {
  const out: string[] = [];
  let parent = index.parentOf.get(id);
  while (parent !== undefined) {
    out.push(parent);
    parent = index.parentOf.get(parent);
  }
  return out;
}

/** Existing, de-duplicated ids whose ancestors are not also selected (they travel with them). */
function topLevelSelection(index: LayerIndex, ids: string[]): string[] {
  const set = new Set(ids.filter((id) => index.byId.has(id)));
  return [...set].filter((id) => !ancestorsOf(index, id).some((ancestor) => set.has(ancestor)));
}

function withParent(layer: AssetLayer, parentId: string | undefined, now: number): AssetLayer {
  // Drop the key at root rather than storing `parentId: undefined` in saved JSON.
  const next: AssetLayer = { ...layer, updatedAt: now };
  if (parentId === undefined) delete next.parentId;
  else next.parentId = parentId;
  return next;
}

function sameOrder(a: AssetLayer[], b: AssetLayer[]): boolean {
  return a.length === b.length && a.every((layer, i) => layer === b[i]);
}

function collectSubtree(index: LayerIndex, id: string, into: Set<string>) {
  for (const child of index.kids.get(id) ?? []) {
    if (into.has(child)) continue;
    into.add(child);
    collectSubtree(index, child, into);
  }
}

// ── Reading ──────────────────────────────────────────────────────────────────

export function buildLayerTree(layers: AssetLayer[]): LayerTreeNode[] {
  const index = indexLayers(layers);
  const build = (key: string, depth: number): LayerTreeNode[] =>
    [...(index.kids.get(key) ?? [])].reverse().map((id) => {
      const layer = index.byId.get(id)!;
      return { layer, depth, children: layer.kind === 'group' ? build(id, depth + 1) : [] };
    });
  return build(ROOT, 0);
}

/** Rows the list shows, top first; children of collapsed groups are skipped. */
export function flattenVisibleRows(
  tree: LayerTreeNode[],
  collapsedOverride?: Partial<Record<string, boolean>>,
): LayerRow[] {
  const rows: LayerRow[] = [];
  const walk = (nodes: LayerTreeNode[], parentId: string | undefined) => {
    nodes.forEach((node, indexInParent) => {
      rows.push({
        layer: node.layer,
        depth: node.depth,
        parentId,
        indexInParent,
        siblingCount: nodes.length,
        hasChildren: node.children.length > 0,
      });
      const collapsed = collapsedOverride?.[node.layer.id] ?? node.layer.collapsed ?? false;
      if (!collapsed && node.children.length) walk(node.children, node.layer.id);
    });
  };
  walk(tree, undefined);
  return rows;
}

/** Every layer nested (at any depth) under `id`, excluding `id` itself. */
export function descendantIds(layers: AssetLayer[], id: string): Set<string> {
  const out = new Set<string>();
  collectSubtree(indexLayers(layers), id, out);
  out.delete(id);
  return out;
}

// ── Structure edits ──────────────────────────────────────────────────────────

/**
 * Moves layers (with their subtrees) under `target.parentId` at display index
 * `target.index`. Returns the input array (same reference) when the move is
 * refused (unknown/non-group parent, group into itself or a descendant) or
 * changes nothing.
 */
export function moveLayers(layers: AssetLayer[], ids: string[], target: MoveTarget): AssetLayer[] {
  const index = indexLayers(layers);
  const { parentId } = target;
  if (parentId !== undefined) {
    const parent = index.byId.get(parentId);
    if (!parent || parent.kind !== 'group') return layers;
  }
  const moving = topLevelSelection(index, ids);
  if (!moving.length) return layers;
  const movingSet = new Set(moving);
  if (parentId !== undefined && (movingSet.has(parentId) || ancestorsOf(index, parentId).some((a) => movingSet.has(a)))) {
    return layers;
  }

  // Keep the selection's relative draw order, whatever order the ids came in.
  const order = drawOrder(index);
  moving.sort((a, b) => order.get(a)! - order.get(b)!);

  const kids = cloneKids(index.kids);
  for (const id of moving) {
    const key = keyOf(index.parentOf.get(id));
    kids.set(key, kids.get(key)!.filter((child) => !movingSet.has(child)));
  }
  const targetKey = keyOf(parentId);
  const display = [...(kids.get(targetKey) ?? [])].reverse();
  const wanted = Number.isFinite(target.index) ? Math.floor(target.index) : display.length;
  const at = Math.max(0, Math.min(display.length, wanted));
  display.splice(at, 0, ...[...moving].reverse());
  kids.set(targetKey, display.reverse());

  // No-op (dropped where it already was): keep the reference so stores skip a write.
  const unchanged = serialize(kids, index.byId);
  const parentsKept = moving.every((id) => index.byId.get(id)!.parentId === parentId);
  if (parentsKept && sameOrder(unchanged, layers)) return layers;

  const now = Date.now();
  const byId = new Map(index.byId);
  for (const id of moving) byId.set(id, withParent(byId.get(id)!, parentId, now));
  return serialize(kids, byId);
}

/**
 * Deep-copies the layers (a group brings its subtree, with fresh ids and
 * remapped parentIds). Each copy lands directly above its original in the same
 * parent; only the top copied layer gets the " copy" suffix.
 * `newIds` are the top copies, top first.
 */
export function duplicateLayers(
  layers: AssetLayer[],
  ids: string[],
  makeId: () => string,
  now: number,
): { layers: AssetLayer[]; newIds: string[] } {
  const index = indexLayers(layers);
  const roots = topLevelSelection(index, ids);
  if (!roots.length) return { layers, newIds: [] };
  const order = drawOrder(index);
  roots.sort((a, b) => order.get(b)! - order.get(a)!);

  const kids = cloneKids(index.kids);
  const byId = new Map(index.byId);
  const copy = (id: string, parentId: string | undefined, rename: boolean): string => {
    const source = index.byId.get(id)!;
    const newId = makeId();
    const base = withParent(source, parentId, now);
    byId.set(newId, {
      ...base,
      id: newId,
      name: rename ? `${source.name} copy`.trim() : source.name,
      createdAt: now,
      updatedAt: now,
    });
    if (source.kind === 'group') {
      kids.set(newId, (index.kids.get(id) ?? []).map((child) => copy(child, newId, false)));
    }
    return newId;
  };

  const newIds: string[] = [];
  for (const root of roots) {
    const parentId = index.parentOf.get(root);
    const newId = copy(root, parentId, true);
    const list = kids.get(keyOf(parentId))!;
    list.splice(list.indexOf(root) + 1, 0, newId);
    newIds.push(newId);
  }
  return { layers: serialize(kids, byId), newIds };
}

/** Removes the layers and everything nested under them. */
export function removeLayers(layers: AssetLayer[], ids: string[]): AssetLayer[] {
  const index = indexLayers(layers);
  const drop = new Set<string>();
  for (const id of ids) {
    if (!index.byId.has(id)) continue;
    drop.add(id);
    collectSubtree(index, id, drop);
  }
  if (!drop.size) return layers;
  return layers.filter((layer) => !drop.has(layer.id));
}

/**
 * Wraps 1+ layers (groups included, so groups can nest) in `group`. The new
 * group takes the parent and display position of the topmost selected layer.
 * Refuses (same reference) when nothing valid is selected or the group's id
 * already exists.
 */
export function groupLayers(layers: AssetLayer[], ids: string[], group: AssetLayer): AssetLayer[] {
  if (group.kind !== 'group') return layers;
  const index = indexLayers(layers);
  if (index.byId.has(group.id)) return layers;
  const members = topLevelSelection(index, ids);
  if (!members.length) return layers;
  const order = drawOrder(index);
  members.sort((a, b) => order.get(a)! - order.get(b)!);

  const topmost = members[members.length - 1];
  const parentId = index.parentOf.get(topmost);
  const kids = cloneKids(index.kids);
  const parentList = kids.get(keyOf(parentId))!;
  // Put the group where the topmost member was, then lift every member out.
  parentList.splice(parentList.indexOf(topmost), 1, group.id);
  const memberSet = new Set(members);
  for (const [key, list] of kids) kids.set(key, list.filter((id) => !memberSet.has(id)));
  kids.set(group.id, [...members]);

  const now = Date.now();
  const byId = new Map(index.byId);
  byId.set(group.id, withParent(group, parentId, group.updatedAt));
  for (const id of members) byId.set(id, withParent(byId.get(id)!, group.id, now));
  return serialize(kids, byId);
}

/** Removes a group; its children take its place inside the group's own parent. */
export function ungroup(layers: AssetLayer[], groupId: string): AssetLayer[] {
  const index = indexLayers(layers);
  const group = index.byId.get(groupId);
  if (!group || group.kind !== 'group') return layers;
  const parentId = index.parentOf.get(groupId);
  const children = index.kids.get(groupId) ?? [];
  const kids = cloneKids(index.kids);
  const list = kids.get(keyOf(parentId))!;
  list.splice(list.indexOf(groupId), 1, ...children);
  kids.delete(groupId);

  const now = Date.now();
  const byId = new Map(index.byId);
  byId.delete(groupId);
  for (const id of children) byId.set(id, withParent(byId.get(id)!, parentId, now));
  return serialize(kids, byId);
}

// ── Targets for the list UI ──────────────────────────────────────────────────

/**
 * Turns "pointer at `pointerFraction` (0 = top, 1 = bottom) of `row`" into a
 * move target. Groups: top 25 % before, middle 50 % into (as top child),
 * bottom 25 % after — or into, when the group is open and shows children right
 * below it. Other rows: top half before, bottom half after.
 * Pass `movingIds` so the index accounts for the dragged rows being removed
 * first; returns null when dropping on the dragged rows or inside them.
 */
export function rowDropTarget(
  row: LayerRow,
  pointerFraction: number,
  rows: LayerRow[],
  movingIds: string[] = [],
): DropTarget | null {
  const moving = new Set(movingIds);
  const parentOf = new Map(rows.map((r) => [r.layer.id, r.parentId]));
  let cursor: string | undefined = row.layer.id;
  const guard = new Set<string>();
  while (cursor !== undefined && !guard.has(cursor)) {
    if (moving.has(cursor)) return null;
    guard.add(cursor);
    cursor = parentOf.get(cursor);
  }

  const f = Math.max(0, Math.min(1, Number.isFinite(pointerFraction) ? pointerFraction : 0.5));
  const isGroup = row.layer.kind === 'group';
  const openWithChildren = isGroup && row.hasChildren
    && rows.some((r) => r.parentId === row.layer.id);

  if (isGroup && f >= 0.25 && f <= 0.75) {
    return { parentId: row.layer.id, index: 0, zone: 'into', depth: row.depth + 1 };
  }
  const before = isGroup ? f < 0.25 : f < 0.5;
  if (!before && openWithChildren) {
    // The line under an open group sits above its first child: that means "into, at the top".
    return { parentId: row.layer.id, index: 0, zone: 'after', depth: row.depth + 1 };
  }
  const raw = before ? row.indexInParent : row.indexInParent + 1;
  const skipped = rows.filter((r) => r.parentId === row.parentId && moving.has(r.layer.id) && r.indexInParent < raw).length;
  return { parentId: row.parentId, index: raw - skipped, zone: before ? 'before' : 'after', depth: row.depth };
}

/**
 * One keyboard step (⌥↑ / ⌥↓) for the selection inside the parent of its
 * top (up) or bottom (down) layer. Null when it cannot move further.
 */
export function nudgeTarget(layers: AssetLayer[], ids: string[], direction: 'up' | 'down'): MoveTarget | null {
  const index = indexLayers(layers);
  const moving = topLevelSelection(index, ids);
  if (!moving.length) return null;
  const order = drawOrder(index);
  moving.sort((a, b) => order.get(b)! - order.get(a)!); // top first
  const anchor = direction === 'up' ? moving[0] : moving[moving.length - 1];
  const parentId = index.parentOf.get(anchor);
  const movingSet = new Set(moving);
  const display = [...(index.kids.get(keyOf(parentId)) ?? [])].reverse();
  const above = display.slice(0, display.indexOf(anchor)).filter((id) => !movingSet.has(id)).length;
  const remaining = display.filter((id) => !movingSet.has(id)).length;
  const target = direction === 'up' ? above - 1 : above + 1;
  if (target < 0 || target > remaining) return null;
  return { parentId, index: target };
}

/** "Move out of group": directly above the enclosing group, in its parent. */
export function outdentTarget(layers: AssetLayer[], ids: string[]): MoveTarget | null {
  const index = indexLayers(layers);
  const moving = topLevelSelection(index, ids);
  if (!moving.length) return null;
  const order = drawOrder(index);
  moving.sort((a, b) => order.get(b)! - order.get(a)!);
  const group = index.parentOf.get(moving[0]);
  if (group === undefined) return null;
  const parentId = index.parentOf.get(group);
  const movingSet = new Set(moving);
  const display = [...(index.kids.get(keyOf(parentId)) ?? [])].reverse().filter((id) => !movingSet.has(id));
  return { parentId, index: display.indexOf(group) };
}
