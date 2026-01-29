import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid3X3,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Layers,
} from 'lucide-react';
import { useCanvasStore, useFileStore, useLogStore, useSettingsStore } from '@/stores';
import { Button } from '../ui/Button';
import styles from './Canvas.module.css';
import type { CanvasItem, Asset } from '@/types';

interface CanvasProps {
  showTimeline?: boolean;
}

export const Canvas: React.FC<CanvasProps> = ({ showTimeline = false }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    items,
    selectedIds,
    viewport,
    addItemFromAsset,
    addItem,
    removeSelected,
    updateItem,
    selectItem,
    clearSelection,
    setViewport,
    zoomIn,
    zoomOut,
    resetViewport,
    copy,
    paste,
    bringToFront,
  } = useCanvasStore();

  const { settings } = useSettingsStore();
  const log = useLogStore((s) => s.log);

  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(settings.showGrid);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          removeSelected();
          log('canvas_remove', `Removed ${selectedIds.length} item(s)`);
        }
      } else if (e.key === 'Escape') {
        clearSelection();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        copy();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        paste();
        log('canvas_add', 'Pasted items from clipboard');
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        useCanvasStore.getState().selectAll();
      } else if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-') {
        zoomOut();
      } else if (e.key === '0') {
        resetViewport();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, removeSelected, clearSelection, copy, paste, zoomIn, zoomOut, resetViewport, log]);

  // Handle drop from explorer
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Calculate position in canvas coordinates
      const x = (e.clientX - rect.left - viewport.x) / viewport.zoom;
      const y = (e.clientY - rect.top - viewport.y) / viewport.zoom;

      // Try to get asset from drag data
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        try {
          const asset: Asset = JSON.parse(data);
          addItemFromAsset(asset, x, y);
          log('canvas_add', `Added ${asset.name} to canvas`, { assetId: asset.id });
          return;
        } catch {
          // Not JSON, continue
        }
      }

      // Handle file drop from OS
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        Array.from(files).forEach(async (file, index) => {
          if (!file.type.startsWith('image/')) return;

          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });

          const img = new Image();
          img.onload = () => {
            addItem({
              type: 'image',
              x: x + index * 20,
              y: y + index * 20,
              width: img.width,
              height: img.height,
              rotation: 0,
              scale: Math.min(1, 400 / Math.max(img.width, img.height)),
              locked: false,
              visible: true,
              src: dataUrl,
              name: file.name,
            });
            log('canvas_add', `Dropped ${file.name} onto canvas`);
          };
          img.src = dataUrl;
        });
      }
    },
    [viewport, addItemFromAsset, addItem, log]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle canvas click (deselect)
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains(styles.canvasContent)) {
        clearSelection();
      }
    },
    [clearSelection]
  );

  // Handle item mouse down (select and start drag)
  const handleItemMouseDown = useCallback(
    (e: React.MouseEvent, item: CanvasItem) => {
      e.stopPropagation();

      if (item.locked) return;

      // Select item
      selectItem(item.id, e.shiftKey || e.metaKey);
      bringToFront(item.id);

      // Start drag
      setDragItemId(item.id);
      setDragStart({
        x: e.clientX - item.x * viewport.zoom,
        y: e.clientY - item.y * viewport.zoom,
      });
    },
    [selectItem, bringToFront, viewport.zoom]
  );

  // Handle mouse move for dragging
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragItemId) {
        const newX = (e.clientX - dragStart.x) / viewport.zoom;
        const newY = (e.clientY - dragStart.y) / viewport.zoom;
        updateItem(dragItemId, { x: newX, y: newY });
      } else if (isPanning) {
        setViewport({
          x: viewport.x + e.movementX,
          y: viewport.y + e.movementY,
        });
      }
    },
    [dragItemId, dragStart, viewport, isPanning, updateItem, setViewport]
  );

  // Handle mouse up (end drag)
  const handleMouseUp = useCallback(() => {
    if (dragItemId) {
      log('canvas_move', 'Moved item on canvas');
    }
    setDragItemId(null);
    setIsPanning(false);
  }, [dragItemId, log]);

  // Handle middle mouse for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
    }
  }, []);

  // Handle wheel for zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(5, Math.max(0.1, viewport.zoom * delta));
        setViewport({ zoom: newZoom });
      } else {
        // Pan
        setViewport({
          x: viewport.x - e.deltaX,
          y: viewport.y - e.deltaY,
        });
      }
    },
    [viewport, setViewport]
  );

  return (
    <div className={styles.canvasWrapper}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomOut}
            title="Zoom Out (-)"
          >
            <ZoomOut size={16} />
          </Button>
          <span className={styles.zoomLevel}>{Math.round(viewport.zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomIn}
            title="Zoom In (+)"
          >
            <ZoomIn size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetViewport}
            title="Reset View (0)"
          >
            <Maximize size={16} />
          </Button>
        </div>

        <div className={styles.toolbarGroup}>
          <Button
            variant={showGrid ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle Grid"
          >
            <Grid3X3 size={16} />
          </Button>
        </div>

        <div className={styles.toolbarGroup}>
          {selectedIds.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  copy();
                  paste();
                }}
                title="Duplicate"
              >
                <Copy size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={removeSelected}
                title="Delete (⌫)"
              >
                <Trash2 size={16} />
              </Button>
            </>
          )}
        </div>

        <div className={styles.itemCount}>
          {items.length} item{items.length !== 1 ? 's' : ''}
          {selectedIds.length > 0 && ` (${selectedIds.length} selected)`}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className={`${styles.canvas} ${isDragging ? styles.dropTarget : ''} ${
          showGrid ? styles.showGrid : ''
        }`}
        onClick={handleCanvasClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        <div
          className={styles.canvasContent}
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              className={`${styles.canvasItem} ${
                selectedIds.includes(item.id) ? styles.selected : ''
              } ${item.locked ? styles.locked : ''}`}
              style={{
                left: item.x,
                top: item.y,
                width: item.width * item.scale,
                height: item.height * item.scale,
                transform: `rotate(${item.rotation}deg)`,
                zIndex: item.zIndex,
                opacity: item.visible ? 1 : 0.3,
              }}
              onMouseDown={(e) => handleItemMouseDown(e, item)}
            >
              {item.src ? (
                <img
                  src={item.src}
                  alt={item.name}
                  className={styles.itemImage}
                  draggable={false}
                />
              ) : (
                <div className={styles.placeholder}>
                  <Layers size={32} />
                  <span>{item.name}</span>
                </div>
              )}

              {/* Selection handles */}
              {selectedIds.includes(item.id) && !item.locked && (
                <>
                  <div className={`${styles.handle} ${styles.handleNW}`} />
                  <div className={`${styles.handle} ${styles.handleNE}`} />
                  <div className={`${styles.handle} ${styles.handleSW}`} />
                  <div className={`${styles.handle} ${styles.handleSE}`} />
                </>
              )}

              {/* Lock indicator */}
              {item.locked && (
                <div className={styles.lockIndicator}>
                  <Lock size={12} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div className={styles.emptyState}>
            <Layers size={48} />
            <h3>Drop images here</h3>
            <p>
              Drag images from the Explorer panel or your computer, or generate
              new images using the Inspector panel.
            </p>
          </div>
        )}

        {/* Drop indicator */}
        {isDragging && (
          <div className={styles.dropIndicator}>
            <span>Drop to add to canvas</span>
          </div>
        )}
      </div>
    </div>
  );
};
