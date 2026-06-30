import React, { useCallback, useMemo } from 'react';
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
  if (item.generationMeta) return 'var(--e-original, #3b82f6)';
  if (item.assetId && !item.generationMeta) return 'var(--e-imported, #22c55e)';
  if (['text', 'shape'].includes(item.type)) return 'var(--e-user-added, #ef4444)';
  return 'var(--e-original, #3b82f6)';
}

function getTypeLabel(item: CanvasItem): string {
  if (item.generationMeta) return 'AI-Generated';
  switch (item.type) {
    case 'image': return 'Image';
    case 'generated': return 'Generated';
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
  switch (item.type) {
    case 'video': return '🎬';
    case 'audio': return '🎵';
    case 'text': return 'T';
    default: return '🖼';
  }
}

export const LayersPanel: React.FC<LayersPanelProps> = ({ isOpen, onClose, width = 260 }) => {
  const items = useCanvasStore((s) => s.items);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const selectItem = useCanvasStore((s) => s.selectItem);
  const updateItem = useCanvasStore((s) => s.updateItem);
  const removeItem = useCanvasStore((s) => s.removeItem);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const sendToBack = useCanvasStore((s) => s.sendToBack);
  const ungroupItems = useCanvasStore((s) => s.ungroupItems);
  const removeItemFromGroup = useCanvasStore((s) => s.removeItemFromGroup);

  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(new Set());

  const { groups, ungrouped } = useMemo(() => {
    const groupMap = new Map<string, CanvasItem[]>();
    const ungroupedItems: CanvasItem[] = [];

    for (const item of items) {
      if (item.groupId) {
        if (!groupMap.has(item.groupId)) groupMap.set(item.groupId, []);
        groupMap.get(item.groupId)!.push(item);
      } else {
        ungroupedItems.push(item);
      }
    }

    ungroupedItems.sort((a, b) => b.zIndex - a.zIndex);

    const groupArray = [...groupMap.entries()].map(([id, members]) => ({
      id,
      members: [...members].sort((a, b) => b.zIndex - a.zIndex),
      maxZ: Math.max(...members.map(m => m.zIndex)),
    }));
    groupArray.sort((a, b) => b.maxZ - a.maxZ);

    return { groups: groupArray, ungrouped: ungroupedItems };
  }, [items]);

  const toggleGroupExpanded = useCallback((groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
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
  }, [selectItem]);

  const handleDelete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeItem(id);
  }, [removeItem]);

  if (!isOpen) return null;

  const renderLayerRow = (item: CanvasItem, indent = false) => {
    const isSelected = selectedIds.includes(item.id);
    const borderColor = getOriginColor(item);

    return (
      <div
        key={item.id}
        className={[
          styles.layerRow,
          isSelected ? styles.layerSelected : '',
          !item.visible ? styles.layerHidden : '',
          indent ? styles.groupedItem : '',
        ].filter(Boolean).join(' ')}
        style={{ borderLeftColor: borderColor }}
        onClick={(e) => handleSelect(item.id, e)}
        data-layer-id={item.id}
      >
        {indent && <span className={styles.groupIndent} />}
        <span className={styles.grip} title="Drag to reorder">
          <GripVertical size={12} />
        </span>
        <span className={styles.layerIcon} title={getTypeLabel(item)}>
          {getTypeIcon(item)}
        </span>
        <span className={`${styles.layerName} ${!item.visible ? styles.layerNameHidden : ''}`}>
          {item.name || getTypeLabel(item)}
        </span>
        <span className={styles.layerInfo}>
          {Math.round(item.width)}×{Math.round(item.height)}
        </span>
        <div className={styles.layerActions}>
          {indent && (
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

        {groups.map(({ id, members }) => {
          const isExpanded = !collapsedGroups.has(id);
          const groupSelected = members.some(m => selectedIds.includes(m.id));

          return (
            <div key={id} className={`${styles.groupContainer} ${groupSelected ? styles.groupContainerSelected : ''}`}>
              <div className={styles.groupHeader} onClick={() => toggleGroupExpanded(id)}>
                <span className={styles.groupChevron}>
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
                <Group size={12} className={styles.groupIcon} />
                <span className={styles.groupLabel}>Group</span>
                <span className={styles.groupCount}>{members.length}</span>
                <div className={styles.groupActions}>
                  <button
                    className={styles.layerActionBtn}
                    onClick={(e) => { e.stopPropagation(); ungroupItems(id); }}
                    title="Ungroup"
                  >
                    <Ungroup size={12} />
                  </button>
                </div>
              </div>
              {isExpanded && members.map(item => renderLayerRow(item, true))}
            </div>
          );
        })}

        {ungrouped.map(item => renderLayerRow(item, false))}
      </div>

      <div className={styles.footer}>
        <span className={styles.footerCount}>{items.length} layer{items.length !== 1 ? 's' : ''}</span>
        <span className={styles.footerHint}>
          {selectedIds.length > 0
            ? `${selectedIds.length} selected`
            : 'Click to select · Drag assets to group'}
        </span>
      </div>
    </aside>
  );
};

export default LayersPanel;
