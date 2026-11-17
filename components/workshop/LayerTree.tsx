import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Plus, Eye, EyeOff, Lock, Unlock, ChevronRight, ChevronDown, MoreHorizontal, GripVertical,
  FolderPlus, FolderMinus, Copy, Trash2, Square, Circle, MoveUpRight, Type as TypeIcon, Pencil,
  Image as ImageIcon, Scan, Ban, SlidersHorizontal, Folder, Layers as LayersIcon,
  ArrowUp, ArrowDown, CornerLeftUp, PenLine,
} from 'lucide-react';
import type { AssetLayer, LayerKind } from '@/types/pipeline';
import {
  buildLayerTree, flattenVisibleRows, nudgeTarget, outdentTarget, rowDropTarget,
  type DropTarget, type LayerRow, type MoveTarget,
} from '@/lib/pipeline/layerTree';
import styles from './LayerTree.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// LayerTree — the layers list: order, groups, drag, rename, add, delete.
// Controlled and store-agnostic: every change goes out through a callback, the
// structure maths lives in lib/pipeline/layerTree.ts (unit-tested).
// Drag uses pointer events, not HTML5 DnD, because HTML5 DnD never fires on
// touch; touch drags start only from the grip so a finger can still scroll.
// ─────────────────────────────────────────────────────────────────────────────

export interface LayerTreeProps {
  layers: AssetLayer[];
  selectedIds: string[];
  onSelect: (ids: string[], primaryId: string | null) => void;
  onMove: (ids: string[], target: { parentId: string | undefined; index: number }) => void;
  onRename: (id: string, name: string) => void;
  onPatch: (id: string, patch: Partial<AssetLayer>) => void;
  onDuplicate: (ids: string[]) => void;
  onDelete: (ids: string[]) => void;
  onGroup: (ids: string[]) => void;
  onUngroup: (groupId: string) => void;
  onAdd: (kind: LayerKind, partial?: Partial<AssetLayer>) => void;
  compact?: boolean;
}

const DRAG_THRESHOLD_PX = 4;

// Local copy of LayerSystem's icon map: importing it from there would create an
// import cycle once LayerSystem renders this component.
function kindIcon(layer: AssetLayer, size = 13): React.ReactNode {
  switch (layer.kind) {
    case 'shape':
      return layer.shape === 'ellipse' ? <Circle size={size} />
        : layer.shape === 'arrow' || layer.shape === 'line' ? <MoveUpRight size={size} />
        : <Square size={size} />;
    case 'text': return <TypeIcon size={size} />;
    case 'image': return <ImageIcon size={size} />;
    case 'mask': return layer.maskMode === 'exclude' ? <Ban size={size} /> : <Scan size={size} />;
    case 'adjustment': return <SlidersHorizontal size={size} />;
    case 'draw': return <Pencil size={size} />;
    case 'group': return <Folder size={size} />;
    default: return <LayersIcon size={size} />;
  }
}

const ADD_ITEMS: { key: string; label: string; kind: LayerKind; partial?: Partial<AssetLayer>; icon: React.ReactNode }[] = [
  { key: 'shape', label: 'Shape', kind: 'shape', icon: <Square size={13} /> },
  { key: 'text', label: 'Text', kind: 'text', icon: <TypeIcon size={13} /> },
  { key: 'draw', label: 'Draw', kind: 'draw', icon: <Pencil size={13} /> },
  { key: 'image', label: 'Image…', kind: 'image', icon: <ImageIcon size={13} /> },
  { key: 'include', label: 'Include mask', kind: 'mask', partial: { maskMode: 'include' }, icon: <Scan size={13} /> },
  { key: 'exclude', label: 'Exclude mask', kind: 'mask', partial: { maskMode: 'exclude' }, icon: <Ban size={13} /> },
  { key: 'filter', label: 'Filter', kind: 'adjustment', icon: <SlidersHorizontal size={13} /> },
  { key: 'group', label: 'Empty group', kind: 'group', icon: <Folder size={13} /> },
];

const plural = (n: number) => (n === 1 ? '1 layer' : `${n} layers`);
const displayName = (layer: AssetLayer) => layer.name || 'Untitled layer';

// ── Menu: role=menu, arrow keys, Esc returns focus, click outside closes ────

interface MenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  run: () => void;
}

const Menu: React.FC<{
  label: string;
  items: MenuItem[];
  style?: React.CSSProperties;
  onClose: (refocus: boolean) => void;
  /** The trigger: a pointerdown on it is its own toggle, not an outside click. */
  ignoreRef?: React.RefObject<HTMLElement>;
}> = ({ label, items, style, onClose, ignoreRef }) => {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const enabled = () => Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);

  useEffect(() => { enabled()[0]?.focus(); }, []);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || ignoreRef?.current?.contains(target)) return;
      closeRef.current(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [ignoreRef]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Keys inside the menu never reach the tree or the canvas shortcuts.
    e.stopPropagation();
    const list = enabled();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const focus = (i: number) => list[(i + list.length) % list.length]?.focus();
    if (e.key === 'ArrowDown') { e.preventDefault(); focus(at + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focus(at - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focus(0); }
    else if (e.key === 'End') { e.preventDefault(); focus(list.length - 1); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeRef.current(true); }
  };

  return (
    <div ref={ref} role="menu" aria-label={label} className={styles.menu} style={style} onKeyDown={onKeyDown}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          className={`${styles.menuItem} ${item.danger ? styles.menuDanger : ''}`}
          disabled={item.disabled}
          onClick={() => { closeRef.current(false); item.run(); }}
        >
          <span className={styles.menuIcon} aria-hidden="true">{item.icon}</span>
          <span className={styles.menuLabel}>{item.label}</span>
          {item.hint && <kbd className={styles.menuHint}>{item.hint}</kbd>}
        </button>
      ))}
    </div>
  );
};

// ── Drag state ──────────────────────────────────────────────────────────────

interface DragState {
  pointerId: number;
  originId: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  ids: string[];
  label: string;
  target: DropTarget | null;
  overId: string | null;
  scroller: HTMLElement | null;
}

interface DragView {
  x: number;
  y: number;
  label: string;
  ids: Set<string>;
  overId: string | null;
  zone: DropTarget['zone'] | null;
  depth: number;
  invalid: boolean;
}

function findScroller(el: HTMLElement | null): HTMLElement | null {
  for (let node = el; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

// ── Component ───────────────────────────────────────────────────────────────

export const LayerTree: React.FC<LayerTreeProps> = ({
  layers, selectedIds, onSelect, onMove, onRename, onPatch, onDuplicate, onDelete, onGroup, onUngroup, onAdd, compact,
}) => {
  const rows = useMemo(() => flattenVisibleRows(buildLayerTree(layers)), [layers]);
  const rowIndex = useMemo(() => new Map(rows.map((row, i) => [row.layer.id, i])), [rows]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const rowEls = useRef(new Map<string, HTMLDivElement>());
  const anchorRef = useRef<string | null>(null);
  const pendingFocus = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const rafRef = useRef(0);
  const helpId = useId();

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<{ id: string; style: React.CSSProperties } | null>(null);
  const [drag, setDrag] = useState<DragView | null>(null);
  const [announce, setAnnounce] = useState('');
  const [isMac, setIsMac] = useState(false);
  const [renaming, setRenamingState] = useState<{ id: string; draft: string } | null>(null);
  // Mirrors `renaming` so Enter-then-blur cannot commit twice from a stale closure.
  const renameRef = useRef<{ id: string; draft: string } | null>(null);
  const setRenaming = (value: { id: string; draft: string } | null) => { renameRef.current = value; setRenamingState(value); };

  useEffect(() => {
    // Read after mount: navigator does not exist during server rendering.
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const keys = {
    group: isMac ? '⌘G' : 'Ctrl+G',
    ungroup: isMac ? '⇧⌘G' : 'Ctrl+Shift+G',
    duplicate: isMac ? '⌘D' : 'Ctrl+D',
    remove: isMac ? '⌫' : 'Del',
    up: isMac ? '⌥↑' : 'Alt+↑',
    down: isMac ? '⌥↓' : 'Alt+↓',
  };

  const focusRow = (id: string) => {
    setFocusedId(id);
    rowEls.current.get(id)?.focus();
  };

  // After a delete, keep keyboard focus in the list instead of dropping it on <body>.
  useEffect(() => {
    if (pendingFocus.current === null) return;
    const i = Math.min(pendingFocus.current, rows.length - 1);
    pendingFocus.current = null;
    if (i >= 0) focusRow(rows[i].layer.id);
    else addBtnRef.current?.focus();
  }, [rows]);

  // When the parent replaces the selection (duplicate, group, add) while the
  // keyboard is in the list, follow it, so F2 / Delete act on what is lit.
  // `followRef` covers commands that remove the focused row (ungroup, group).
  const followRef = useRef(false);
  useEffect(() => {
    const target = selectedIds.find((id) => rowIndex.has(id));
    // A selection replaced from outside also resets the Shift-range anchor.
    if (target && (!anchorRef.current || !selectedIds.includes(anchorRef.current))) anchorRef.current = target;
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    const inList = !!active && !!rootRef.current?.contains(active) && active.getAttribute('role') === 'treeitem';
    const follow = followRef.current;
    followRef.current = false;
    if (!inList && !follow) return;
    const focusedSelected = inList && focusedId != null && selectedIds.includes(focusedId);
    if (!focusedSelected && target) requestAnimationFrame(() => focusRow(target));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);
  const keyboardInList = () => {
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    return !!active && !!rootRef.current?.contains(active);
  };

  const tabStopId = (focusedId && rowIndex.has(focusedId) ? focusedId : null)
    ?? selectedIds.find((id) => rowIndex.has(id))
    ?? rows[0]?.layer.id;

  const actionIds = (fallback: string | null) => (selectedIds.length ? selectedIds : fallback ? [fallback] : []);
  const layerById = (id: string) => layers.find((layer) => layer.id === id);

  // ── Commands (shared by toolbar, row menu, shortcuts) ──
  const doDelete = (ids: string[]) => {
    if (!ids.length) return;
    const first = Math.min(...ids.map((id) => rowIndex.get(id) ?? Number.POSITIVE_INFINITY));
    pendingFocus.current = Number.isFinite(first) ? first : 0;
    onDelete(ids);
    setAnnounce(`Deleted ${plural(ids.length)}`);
  };
  const doDuplicate = (ids: string[]) => {
    if (!ids.length) return;
    followRef.current = keyboardInList();
    onDuplicate(ids);
    setAnnounce(`Duplicated ${plural(ids.length)}`);
  };
  const doGroup = (ids: string[]) => {
    if (!ids.length) return;
    followRef.current = keyboardInList();
    onGroup(ids);
    setAnnounce(`Grouped ${plural(ids.length)}`);
  };
  const doUngroup = (ids: string[]) => {
    const group = ids.map(layerById).find((layer) => layer?.kind === 'group');
    if (!group) return;
    followRef.current = keyboardInList();
    onUngroup(group.id);
    setAnnounce(`Ungrouped ${displayName(group)}`);
  };
  const doMove = (ids: string[], target: MoveTarget | null, message: string) => {
    if (!ids.length || !target) return;
    onMove(ids, target);
    setAnnounce(message);
  };

  // ── Selection ──
  const select = (id: string, mods: { shift: boolean; toggle: boolean }) => {
    const anchor = anchorRef.current;
    if (mods.shift && anchor && rowIndex.has(anchor) && rowIndex.has(id)) {
      const a = rowIndex.get(anchor)!;
      const b = rowIndex.get(id)!;
      onSelect(rows.slice(Math.min(a, b), Math.max(a, b) + 1).map((row) => row.layer.id), id);
    } else if (mods.toggle) {
      const next = selected.has(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id];
      onSelect(next, next.includes(id) ? id : next[next.length - 1] ?? null);
      anchorRef.current = id;
    } else {
      onSelect([id], id);
      anchorRef.current = id;
    }
    setFocusedId(id);
  };

  // ── Rename ──
  const startRename = (id: string) => {
    const layer = layerById(id);
    if (!layer) return;
    setRowMenu(null);
    setRenaming({ id, draft: layer.name });
  };
  const commitRename = (refocus: boolean) => {
    const current = renameRef.current;
    if (!current) return;
    setRenaming(null);
    const layer = layerById(current.id);
    const name = current.draft.trim();
    // An empty name reverts: a layer row without a label is impossible to find again.
    if (layer && name && name !== layer.name) onRename(current.id, name);
    if (refocus) focusRow(current.id);
  };
  const cancelRename = () => {
    const current = renameRef.current;
    setRenaming(null);
    if (current) focusRow(current.id);
  };

  // ── Row menu ──
  const openRowMenu = (id: string, anchor: { left: number; right: number; top: number; bottom: number }, alignRight: boolean) => {
    const root = rootRef.current;
    if (!root) return;
    const box = root.getBoundingClientRect();
    // The panel may sit inside a scaled canvas overlay: convert screen px to local px.
    const scale = box.width ? root.offsetWidth / box.width : 1;
    const width = Math.min(208, root.offsetWidth - 8);
    const x = ((alignRight ? anchor.right : anchor.left) - box.left) * scale - (alignRight ? width : 0);
    const left = Math.max(4, Math.min(x, root.offsetWidth - width - 4));
    const openUp = anchor.bottom + 320 > window.innerHeight && anchor.top > 320;
    const style: React.CSSProperties = openUp
      ? { left, width, bottom: (box.bottom - anchor.top) * scale }
      : { left, width, top: (anchor.bottom - box.top) * scale };
    setAddOpen(false);
    setRowMenu({ id, style });
  };
  const openRowMenuAtRow = (id: string) => {
    const el = rowEls.current.get(id);
    if (el) openRowMenu(id, el.getBoundingClientRect(), true);
  };

  const rowMenuItems = (id: string): MenuItem[] => {
    const i = rowIndex.get(id);
    const layer = layerById(id);
    if (i === undefined || !layer) return [];
    const row = rows[i];
    const ids = selected.has(id) ? selectedIds : [id];
    const back = () => focusRow(id);
    return [
      { key: 'rename', label: 'Rename', icon: <PenLine size={13} />, hint: 'F2', run: () => startRename(id) },
      { key: 'visible', label: layer.visible ? 'Hide' : 'Show', icon: layer.visible ? <EyeOff size={13} /> : <Eye size={13} />, run: () => { onPatch(id, { visible: !layer.visible }); back(); } },
      { key: 'lock', label: layer.locked ? 'Unlock' : 'Lock', icon: layer.locked ? <Unlock size={13} /> : <Lock size={13} />, run: () => { onPatch(id, { locked: !layer.locked }); back(); } },
      { key: 'duplicate', label: 'Duplicate', icon: <Copy size={13} />, hint: keys.duplicate, run: () => { doDuplicate(ids); back(); } },
      { key: 'group', label: 'Group', icon: <FolderPlus size={13} />, hint: keys.group, run: () => doGroup(ids) },
      ...(layer.kind === 'group'
        ? [{ key: 'ungroup', label: 'Ungroup', icon: <FolderMinus size={13} />, hint: keys.ungroup, run: () => doUngroup([id]) }]
        : []),
      { key: 'up', label: 'Move up', icon: <ArrowUp size={13} />, hint: keys.up, disabled: !nudgeTarget(layers, ids, 'up'), run: () => { doMove(ids, nudgeTarget(layers, ids, 'up'), 'Moved up'); back(); } },
      { key: 'down', label: 'Move down', icon: <ArrowDown size={13} />, hint: keys.down, disabled: !nudgeTarget(layers, ids, 'down'), run: () => { doMove(ids, nudgeTarget(layers, ids, 'down'), 'Moved down'); back(); } },
      ...(row.parentId
        ? [{ key: 'out', label: 'Move out of group', icon: <CornerLeftUp size={13} />, run: () => { doMove(ids, outdentTarget(layers, ids), 'Moved out of the group'); back(); } }]
        : []),
      { key: 'delete', label: 'Delete', icon: <Trash2 size={13} />, hint: keys.remove, danger: true, run: () => doDelete(ids) },
    ];
  };

  // ── Keyboard ──
  const onTreeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const id = focusedId && rowIndex.has(focusedId) ? focusedId : null;
    const i = id ? rowIndex.get(id)! : -1;
    const row = i >= 0 ? rows[i] : null;
    const mod = e.metaKey || e.ctrlKey;
    const handled = () => { e.preventDefault(); e.stopPropagation(); };
    const go = (j: number) => {
      const next = rows[Math.max(0, Math.min(rows.length - 1, j))];
      if (!next) return;
      focusRow(next.layer.id);
      if (e.shiftKey) {
        if (!anchorRef.current || !rowIndex.has(anchorRef.current)) anchorRef.current = id ?? next.layer.id;
        select(next.layer.id, { shift: true, toggle: false });
      }
    };

    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowDown': {
        const dir = e.key === 'ArrowUp' ? 'up' : 'down';
        handled();
        if (e.altKey) {
          const ids = actionIds(id);
          doMove(ids, nudgeTarget(layers, ids, dir), dir === 'up' ? 'Moved up' : 'Moved down');
          if (id) requestAnimationFrame(() => rowEls.current.get(id)?.focus());
          return;
        }
        go(i < 0 ? 0 : i + (dir === 'up' ? -1 : 1));
        return;
      }
      case 'Home': handled(); go(0); return;
      case 'End': handled(); go(rows.length - 1); return;
      case 'ArrowRight':
        if (row?.layer.kind === 'group') {
          handled();
          if (row.layer.collapsed) onPatch(row.layer.id, { collapsed: false });
          else if (rows[i + 1]?.parentId === row.layer.id) focusRow(rows[i + 1].layer.id);
        }
        return;
      case 'ArrowLeft':
        if (!row) return;
        handled();
        if (row.layer.kind === 'group' && !row.layer.collapsed && row.hasChildren) onPatch(row.layer.id, { collapsed: true });
        else if (row.parentId) focusRow(row.parentId);
        return;
      case ' ':
        if (!row) return;
        handled();
        select(row.layer.id, { shift: e.shiftKey, toggle: mod });
        return;
      case 'Enter':
        if (!row) return;
        handled();
        // Enter on the already-selected row renames it; otherwise it selects.
        if (selectedIds.length === 1 && selectedIds[0] === row.layer.id) startRename(row.layer.id);
        else select(row.layer.id, { shift: e.shiftKey, toggle: mod });
        return;
      case 'F2':
        if (!row) return;
        handled();
        startRename(row.layer.id);
        return;
      case 'Delete':
      case 'Backspace':
        handled();
        doDelete(actionIds(id));
        return;
      case 'ContextMenu':
        if (!row) return;
        handled();
        openRowMenuAtRow(row.layer.id);
        return;
      case 'F10':
        if (!row || !e.shiftKey) return;
        handled();
        openRowMenuAtRow(row.layer.id);
        return;
      case 'a':
      case 'A':
        if (!mod) return;
        handled();
        onSelect(rows.map((r) => r.layer.id), id);
        return;
      default:
    }
  };

  // ⌘G / ⇧⌘G / ⌘D work anywhere in the panel (list or toolbar), never in a text field.
  const onRootKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || !(e.metaKey || e.ctrlKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key !== 'g' && key !== 'd') return;
    e.preventDefault();
    e.stopPropagation();
    const ids = actionIds(focusedId);
    if (key === 'd') doDuplicate(ids);
    else if (e.shiftKey) doUngroup(ids);
    else doGroup(ids);
  };

  // ── Drag & drop (pointer events) ──
  const computeTarget = (d: DragState) => {
    const list = rowsRef.current;
    d.target = null;
    d.overId = null;
    if (!list.length) return;
    for (const row of list) {
      const el = rowEls.current.get(row.layer.id);
      if (!el) continue;
      const box = el.getBoundingClientRect();
      // First row whose bottom is below the pointer: gaps count as that row's top edge.
      if (d.y < box.bottom) {
        d.overId = row.layer.id;
        d.target = rowDropTarget(row, (d.y - box.top) / (box.height || 1), list, d.ids);
        return;
      }
    }
    // Below every row: bottom of the stack, at root.
    const moving = new Set(d.ids);
    d.overId = list[list.length - 1].layer.id;
    d.target = {
      parentId: undefined,
      index: list.filter((row) => row.parentId === undefined && !moving.has(row.layer.id)).length,
      zone: 'after',
      depth: 0,
    };
  };

  const paint = (d: DragState) => {
    const root = rootRef.current;
    if (!root) return;
    const box = root.getBoundingClientRect();
    const scale = box.width ? root.offsetWidth / box.width : 1;
    setDrag({
      x: (d.x - box.left) * scale,
      y: (d.y - box.top) * scale,
      label: d.label,
      ids: new Set(d.ids),
      overId: d.overId,
      zone: d.target?.zone ?? null,
      depth: d.target?.depth ?? 0,
      invalid: !d.target,
    });
  };

  const autoScroll = () => {
    const d = dragRef.current;
    if (!d?.active) return;
    const scroller = d.scroller;
    if (scroller) {
      const box = scroller.getBoundingClientRect();
      const edge = Math.min(40, box.height / 4);
      const over = d.y < box.top + edge ? d.y - (box.top + edge) : d.y > box.bottom - edge ? d.y - (box.bottom - edge) : 0;
      if (over) {
        // Faster the deeper the pointer sits in the edge band, capped so it stays controllable.
        scroller.scrollTop += Math.max(-16, Math.min(16, over / 2));
        computeTarget(d);
        paint(d);
      }
    }
    rafRef.current = requestAnimationFrame(autoScroll);
  };

  const finishDrag = (commit: boolean) => {
    const d = dragRef.current;
    dragRef.current = null;
    cancelAnimationFrame(rafRef.current);
    if (!d?.active) return;
    suppressClick.current = true;
    try { listRef.current?.releasePointerCapture(d.pointerId); } catch { /* already released */ }
    setDrag(null);
    if (commit && d.target) doMove(d.ids, { parentId: d.target.parentId, index: d.target.index }, `Moved ${plural(d.ids.length)}`);
  };
  const finishRef = useRef(finishDrag);
  finishRef.current = finishDrag;

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      finishRef.current(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dragging]);

  const onRowPointerDown = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    suppressClick.current = false;
    const el = e.target as HTMLElement;
    const fromGrip = Boolean(el.closest('[data-grip]'));
    if (e.pointerType === 'mouse' && (e.button !== 0 || (isMac && e.ctrlKey))) return;
    if (e.pointerType === 'touch' && !fromGrip) return; // keep finger scrolling on the row body
    if (!fromGrip && el.closest('button, input')) return;
    if (renameRef.current?.id === id) return;
    dragRef.current = {
      pointerId: e.pointerId, originId: id, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY,
      active: false, ids: [], label: '', target: null, overId: null, scroller: null,
    };
  };

  const onListPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    d.x = e.clientX;
    d.y = e.clientY;
    if (!d.active) {
      // The button was released outside the list before the drag started: forget the press.
      if (e.buttons === 0) { dragRef.current = null; return; }
      if (Math.hypot(d.x - d.startX, d.y - d.startY) < DRAG_THRESHOLD_PX) return;
      // Dragging a selected row carries the whole selection; any other row goes alone.
      const ids = selected.has(d.originId) ? [...selectedIds] : [d.originId];
      if (!selected.has(d.originId)) {
        onSelect([d.originId], d.originId);
        anchorRef.current = d.originId;
      }
      const origin = layerById(d.originId);
      d.ids = ids;
      d.label = ids.length > 1 ? plural(ids.length) : origin ? displayName(origin) : 'Layer';
      d.active = true;
      d.scroller = findScroller(listRef.current);
      try { listRef.current?.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      setRowMenu(null);
      setAddOpen(false);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(autoScroll);
    }
    e.preventDefault();
    computeTarget(d);
    paint(d);
  };

  // ── Render ──
  const addItems: MenuItem[] = ADD_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
    run: () => { onAdd(item.kind, item.partial); addBtnRef.current?.focus(); },
  }));
  const hasSelection = selectedIds.length > 0;

  const renderRow = (row: LayerRow) => {
    const { layer, depth } = row;
    const id = layer.id;
    const isGroup = layer.kind === 'group';
    const isSelected = selected.has(id);
    const name = displayName(layer);
    const over = drag?.overId === id;
    const isRenaming = renaming?.id === id;
    const style = { '--depth': depth, '--drop-depth': over ? drag?.depth ?? depth : depth } as React.CSSProperties;
    return (
      <div
        key={id}
        ref={(el) => { if (el) rowEls.current.set(id, el); else rowEls.current.delete(id); }}
        role="treeitem"
        aria-level={depth + 1}
        aria-setsize={row.siblingCount}
        aria-posinset={row.indexInParent + 1}
        aria-selected={isSelected}
        aria-expanded={isGroup ? !layer.collapsed : undefined}
        aria-label={`${name}${layer.visible ? '' : ', hidden'}${layer.locked ? ', locked' : ''}`}
        tabIndex={id === tabStopId ? 0 : -1}
        className={styles.row}
        data-selected={isSelected || undefined}
        data-hidden={!layer.visible || undefined}
        data-dragging={drag?.ids.has(id) || undefined}
        data-drop={over && !drag?.invalid ? drag?.zone ?? undefined : undefined}
        data-drop-invalid={over && drag?.invalid ? true : undefined}
        style={style}
        onFocus={(e) => { if (e.target === e.currentTarget) setFocusedId(id); }}
        onPointerDown={(e) => onRowPointerDown(e, id)}
        onClick={(e) => {
          e.stopPropagation();
          if (suppressClick.current) { suppressClick.current = false; return; }
          select(id, { shift: e.shiftKey, toggle: e.metaKey || e.ctrlKey });
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!isSelected) select(id, { shift: false, toggle: false });
          openRowMenu(id, { left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }, false);
        }}
      >
        <span className={styles.grip} data-grip="" aria-hidden="true" title="Drag to reorder">
          <GripVertical size={12} />
        </span>
        <span className={styles.indent} aria-hidden="true" />
        {isGroup ? (
          <button
            type="button"
            tabIndex={-1}
            className={styles.iconBtn}
            aria-label={layer.collapsed ? `Expand ${name}` : `Collapse ${name}`}
            title={layer.collapsed ? 'Expand (→)' : 'Collapse (←)'}
            onClick={(e) => { e.stopPropagation(); onPatch(id, { collapsed: !layer.collapsed }); }}
          >
            {layer.collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>
        ) : (
          <span className={styles.chevronSpacer} aria-hidden="true" />
        )}
        <span className={styles.kind} data-mask={layer.kind === 'mask' ? layer.maskMode ?? 'include' : undefined} aria-hidden="true">
          {kindIcon(layer)}
        </span>
        {isRenaming ? (
          <input
            className={styles.renameInput}
            value={renaming?.draft ?? ''}
            aria-label={`Rename ${name}`}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setRenaming({ id, draft: e.target.value })}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') { e.preventDefault(); commitRename(true); }
              else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
            }}
            onBlur={() => commitRename(false)}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={styles.name} title={name} onDoubleClick={(e) => { e.stopPropagation(); startRename(id); }}>
            {name}
          </span>
        )}
        <button
          type="button"
          tabIndex={-1}
          className={styles.iconBtn}
          data-off={!layer.visible || undefined}
          aria-label={layer.visible ? `Hide ${name}` : `Show ${name}`}
          title={layer.visible ? 'Hide' : 'Show'}
          onClick={(e) => { e.stopPropagation(); onPatch(id, { visible: !layer.visible }); }}
        >
          {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
        {(!compact || layer.locked) && (
          <button
            type="button"
            tabIndex={-1}
            className={styles.iconBtn}
            data-on={layer.locked || undefined}
            aria-label={layer.locked ? `Unlock ${name}` : `Lock ${name}`}
            title={layer.locked ? 'Unlock' : 'Lock'}
            onClick={(e) => { e.stopPropagation(); onPatch(id, { locked: !layer.locked }); }}
          >
            {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          className={styles.iconBtn}
          aria-label={`More actions for ${name}`}
          aria-haspopup="menu"
          aria-expanded={rowMenu?.id === id}
          title="More actions (Shift+F10)"
          onClick={(e) => {
            e.stopPropagation();
            if (rowMenu?.id === id) { setRowMenu(null); return; }
            if (!isSelected) select(id, { shift: false, toggle: false });
            openRowMenu(id, e.currentTarget.getBoundingClientRect(), true);
          }}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${compact ? styles.compact : ''}`}
      data-layer-tree=""
      data-dragging={dragging || undefined}
      onKeyDown={onRootKeyDown}
    >
      <div className={styles.header}>
        <div className={styles.addWrap}>
          <button
            ref={addBtnRef}
            type="button"
            className={styles.addBtn}
            aria-haspopup="menu"
            aria-expanded={addOpen}
            aria-label="Add layer"
            title="Add layer"
            onClick={() => { setRowMenu(null); setAddOpen((open) => !open); }}
          >
            <Plus size={14} aria-hidden="true" />
            <span className={styles.addLabel}>Add layer</span>
          </button>
          {addOpen && (
            <Menu
              label="Add layer"
              items={addItems}
              ignoreRef={addBtnRef}
              onClose={(refocus) => { setAddOpen(false); if (refocus) addBtnRef.current?.focus(); }}
            />
          )}
        </div>
        {selectedIds.length > 1 && <span className={styles.count}>{selectedIds.length} selected</span>}
        <div className={styles.tools} role="group" aria-label="Selected layers">
          <button type="button" className={styles.toolBtn} disabled={!hasSelection}
            aria-label={`Group selected layers (${keys.group})`} title={`Group (${keys.group})`}
            onClick={() => doGroup(selectedIds)}>
            <FolderPlus size={14} />
          </button>
          <button type="button" className={styles.toolBtn} disabled={!hasSelection}
            aria-label={`Duplicate selected layers (${keys.duplicate})`} title={`Duplicate (${keys.duplicate})`}
            onClick={() => doDuplicate(selectedIds)}>
            <Copy size={14} />
          </button>
          <button type="button" className={`${styles.toolBtn} ${styles.toolDanger}`} disabled={!hasSelection}
            aria-label={`Delete selected layers (${keys.remove})`} title={`Delete (${keys.remove})`}
            onClick={() => doDelete(selectedIds)}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <p>No layers yet. Add one to draw, write or mark regions on the picture.</p>
          <button type="button" className={styles.addBtn} onClick={() => { setRowMenu(null); setAddOpen(true); }}>
            <Plus size={14} aria-hidden="true" /> Add layer
          </button>
        </div>
      ) : (
        <div
          ref={listRef}
          role="tree"
          aria-label="Layers"
          aria-multiselectable="true"
          aria-describedby={helpId}
          className={styles.list}
          onKeyDown={onTreeKeyDown}
          onClick={(e) => {
            if (suppressClick.current) { suppressClick.current = false; return; }
            if (e.target === e.currentTarget) onSelect([], null);
          }}
          onPointerMove={onListPointerMove}
          onPointerUp={() => finishDrag(true)}
          onPointerCancel={() => finishDrag(false)}
          onLostPointerCapture={() => { if (dragRef.current?.active) finishDrag(false); }}
        >
          {rows.map(renderRow)}
        </div>
      )}

      {rowMenu && (
        <Menu
          label="Layer actions"
          items={rowMenuItems(rowMenu.id)}
          style={{ position: 'absolute', ...rowMenu.style }}
          onClose={(refocus) => { const id = rowMenu.id; setRowMenu(null); if (refocus) focusRow(id); }}
        />
      )}

      {drag && (
        <div className={styles.ghost} data-invalid={drag.invalid || undefined} style={{ left: drag.x + 14, top: drag.y + 18 /* below the pointer: the drop line / highlight stays visible */ }} aria-hidden="true">
          <span className={styles.ghostLabel}>{drag.label}</span>
          {drag.invalid && <span className={styles.ghostNote}>Can’t drop here</span>}
        </div>
      )}

      <p id={helpId} className={styles.srOnly}>
        Arrow keys move between layers, Shift extends the selection, Alt with arrows reorders,
        F2 renames, Shift F10 opens the layer actions.
      </p>
      <div className={styles.srOnly} aria-live="polite">{announce}</div>
    </div>
  );
};

export default LayerTree;
