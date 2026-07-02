import React, { useCallback, useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  GripVertical,
  Group,
  Ungroup,
  X,
  ChevronRight,
  ChevronDown,
  LogOut,
  Link2,
} from 'lucide-react';
import { useCanvasStore } from '@/stores';
import type { CanvasItem } from '@/types';
import styles from './LayersPanel.module.css';

interface LayersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  width?: number;
}

function getOriginColor(item: CanvasItem): string {
  if (!item.visible) return 'var(--e-hidden, #6b7280)';
  if (item.layerRole === 'overlay' || item.parentItemId) return 'var(--e-user-added, #ef4444)';
  if (item.generationMeta || item.layerRole === 'generated') return 'var(--e-original, #3b82f6)';
  if (item.assetId && !item.generationMeta) return 'var(--e-imported, #22c55e)';
  if (['text', 'shape', 'drawing'].includes(item.type)) return 'var(--e-user-added, #ef4444)';
  return 'var(--e-original, #3b82f6)';
}

function getTypeLabel(item: CanvasItem): string {
  if (item.layerRole === 'overlay') return 'Overlay Layer';
  if (item.generationMeta || item.layerRole === 'generated') return 'AI-Generated';
  switch (item.type) {
    case 'image': return 'Image';
    case 'generated': return 'Generated';
    case 'drawing': return 'Drawing';
    case 'shape': return 'Shape';
    case 'placeholder': return 'Placeholder';
    case 'video': return 'Video';
    case 'audio': return 'Audio';
    case 'text': return 'Text';
    case 'template': return 'Template';
    default: return item.type;
  }
}

function getTypeIcon(item: CanvasItem): string {
  if (item.generationMeta) return '✨';
  if (item.type === 'drawing') return '✏️';
  if (item.type === 'shape') return '⬜';
  switch (item.type) {
    case 'video': return '🎬';
    case 'audio': return '🎵';
    case 'text': return 'T';
    default: return '🖼';
  }
}

export const LayersPanel: React.FC<LayersPanelProps> = ({ isOpen, onClose, width = 260 }) => {
  const items = useCanvasStore((s) => s.items);
  const groups = useCanvasStore((s) => s.groups);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const selectItem = useCanvasStore((s) => s.selectItem);
  const focusItemInViewport = useCanvasStore((s) => s.focusItemInViewport);
  const updateItem = useCanvasStore((s) => s.updateItem);
  const removeItem = useCanvasStore((s) => s.removeItem);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const sendToBack = useCanvasStore((s) => s.sendToBack);
  const reorderLayer = useCanvasStore((s) => s.reorderLayer);
  const ungroupItems = useCanvasStore((s) => s.ungroupItems);
  const removeItemFromGroup = useCanvasStore((s) => s.removeItemFromGroup);
  const setGroupCollapsed = useCanvasStore((s) => s.setGroupCollapsed);
  const detachLayerFromParent = useCanvasStore((s) => s.detachLayerFromParent);
  const getChildLayers = useCanvasStore((s) => s.getChildLayers);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());
  const [dragLayerId, setDragLayerId] = useState<string | null>(null);

  const { groupMap, rootItems } = useMemo(() => {
    const gMap = new Map<string, CanvasItem[]>();
    const roots: CanvasItem[] = [];

    for (const item of items) {
      if (item.parentItemId) continue;
      if (item.groupId) {
        if (!gMap.has(item.groupId)) gMap.set(item.groupId, []);
        gMap.get(item.groupId)!.push(item);
      } else {
        roots.push(item);
      }
    }

    roots.sort((a, b) => b.zIndex - a.zIndex);
    for (const [, members] of gMap) {
      members.sort((a, b) => b.zIndex - a.zIndex);
    }

    return { groupMap: gMap, rootItems: roots };
  }, [items]);

  const toggleGroupExpanded = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const toggleParentExpanded = useCallback((parentId: string) => {
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }, []);

  const toggleVisibility = useCallback((id: string, visible: boolean) => {
    updateItem(id, { visible: !visible });
  }, [updateItem]);

  const toggleLock = useCallback((id: string, locked: boolean) => {
    updateItem(id, { locked: !locked });
  }, [updateItem]);

  const handleSelect = useCallback((id: string, e: React.MouseEvent) => {
    selectItem(id, e.shiftKey || e.metaKey || e.ctrlKey);
    if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
      focusItemInViewport(id);
    }
  }, [selectItem, focusItemInViewport]);

  const handleDelete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeItem(id);
  }, [removeItem]);

  const handleLayerDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    setDragLayerId(itemId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleLayerDrop = useCallback((e: React.DragEvent, targetItem: CanvasItem) => {
    e.preventDefault();
    if (!dragLayerId || dragLayerId === targetItem.id) return;
    reorderLayer(dragLayerId, targetItem.zIndex + 1);
    setDragLayerId(null);
  }, [dragLayerId, reorderLayer]);

  if (!isOpen) return null;

  const renderLayerRow = (item: CanvasItem, indent = 0) => {
    const isSelected = selectedIds.includes(item.id);
    const borderColor = getOriginColor(item);
    const children = getChildLayers(item.id);
    const hasChildren = children.length > 0;
    const isParentExpanded = !collapsedParents.has(item.id);

    return (
      <React.Fragment key={item.id}>
        <div
          className={[
            styles.layerRow,
            isSelected ? styles.layerSelected : '',
            !item.visible ? styles.layerHidden : '',
            indent > 0 ? styles.groupedItem : '',
          ].filter(Boolean).join(' ')}
          style={{ borderLeftColor: borderColor, paddingLeft: `${8 + indent * 12}px` }}
          onClick={(e) => handleSelect(item.id, e)}
          data-layer-id={item.id}
          draggable
          onDragStart={(e) => handleLayerDragStart(e, item.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleLayerDrop(e, item)}
        >
          {hasChildren && (
            <button
              type="button"
              className={styles.layerChevronBtn}
              onClick={(e) => { e.stopPropagation(); toggleParentExpanded(item.id); }}
            >
              {isParentExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            </button>
          )}
          <span className={styles.grip} title="Drag to reorder">
            <GripVertical size={12} />
          </span>
          <span className={styles.layerIcon} title={getTypeLabel(item)}>
            {getTypeIcon(item)}
          </span>
          <span className={`${styles.layerName} ${!item.visible ? styles.layerNameHidden : ''}`}>
            {item.name || getTypeLabel(item)}
          </span>
          {item.parentItemId && (
            <Link2 size={10} className={styles.layerLinkIcon} title="Overlay layer" />
          )}
          <span className={styles.layerInfo}>
            {Math.round(item.width)}×{Math.round(item.height)}
          </span>
          <div className={styles.layerActions}>
            {item.parentItemId && (
              <button
                className={styles.layerActionBtn}
                onClick={(e) => { e.stopPropagation(); detachLayerFromParent(item.id); }}
                title="Detach from parent"
              >
                <LogOut size={12} />
              </button>
            )}
            {indent > 0 && item.groupId && (
              <button
                className={styles.layerActionBtn}
                onClick={(e) => { e.stopPropagation(); removeItemFromGroup(item.id); }}
                title="Remove from group"
              >
                <LogOut size={12} />
              </button>
            )}
            <button
              className={styles.layerActionBtn}
              onClick={(e) => { e.stopPropagation(); toggleLock(item.id, item.locked); }}
              title={item.locked ? 'Unlock' : 'Lock'}
            >
              {item.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
            <button
              className={styles.layerActionBtn}
              onClick={(e) => { e.stopPropagation(); toggleVisibility(item.id, item.visible); }}
              title={item.visible ? 'Hide' : 'Show'}
            >
              {item.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
            <button
              className={`${styles.layerActionBtn} ${styles.layerActionDanger}`}
              onClick={(e) => handleDelete(item.id, e)}
              title="Delete layer"
            >
              <Trash2 size={12} />
            </button>
          </div>
          {isSelected && (
            <div className={styles.layerZActions}>
              <button onClick={(e) => { e.stopPropagation(); bringToFront(item.id); }} title="Bring to front">↑↑</button>
              <button onClick={(e) => { e.stopPropagation(); sendToBack(item.id); }} title="Send to back">↓↓</button>
            </div>
          )}
        </div>
        {hasChildren && isParentExpanded &&
          children.sort((a, b) => a.zIndex - b.zIndex).map((child) => renderLayerRow(child, indent + 1))}
      </React.Fragment>
    );
  };

  return (
    <aside className={styles.panel} style={{ width }}>
      <div className={styles.header}>
        <h3 className={styles.title}>Layers</h3>
        <div className={styles.headerActions}>
          <button className={styles.headerBtn} onClick={onClose} title="Close layers panel">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className={styles.list}>
        {items.length === 0 && (
          <div className={styles.empty}>
            <p>No layers yet</p>
            <span>Add assets to the canvas to see them here.</span>
          </div>
        )}

        {groups.map((group) => {
          const members = groupMap.get(group.id) ?? [];
          const isExpanded = !collapsedGroups.has(group.id) && !group.collapsed;
          const groupSelected = members.some((m) => selectedIds.includes(m.id));

          return (
            <div key={group.id} className={`${styles.groupContainer} ${groupSelected ? styles.groupContainerSelected : ''}`}>
              <div className={styles.groupHeader} onClick={() => toggleGroupExpanded(group.id)}>
                <span className={styles.groupChevron}>
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
                <Group size={12} className={styles.groupIcon} />
                <span className={styles.groupLabel}>{group.name}</span>
                <span className={styles.groupCount}>{members.length}</span>
                <div className={styles.groupActions}>
                  <button
                    className={styles.layerActionBtn}
                    onClick={(e) => { e.stopPropagation(); setGroupCollapsed(group.id, !group.collapsed); }}
                    title={group.collapsed ? 'Expand group' : 'Collapse group'}
                  >
                    {group.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  </button>
                  <button
                    className={styles.layerActionBtn}
                    onClick={(e) => { e.stopPropagation(); ungroupItems(group.id); }}
                    title="Ungroup"
                  >
                    <Ungroup size={12} />
                  </button>
                </div>
              </div>
              {isExpanded && members.map((item) => renderLayerRow(item, 1))}
            </div>
          );
        })}

        {rootItems.filter((i) => !i.groupId).map((item) => renderLayerRow(item, 0))}
      </div>

      <div className={styles.footer}>
        <span className={styles.footerCount}>{items.length} layer{items.length !== 1 ? 's' : ''}</span>
        <span className={styles.footerHint}>
          {selectedIds.length > 0
            ? `${selectedIds.length} selected · drag grip to reorder`
            : 'Click to select · Drag grip to reorder'}
        </span>
      </div>
    </aside>
  );
};

export default LayersPanel;
