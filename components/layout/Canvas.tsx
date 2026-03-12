import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid3X3,
  Trash2,
  Copy,
  Layers,
  Undo2,
  Redo2,
  Download,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { useCanvasStore, useFileStore, useLogStore, useSettingsStore } from '@/stores';
import { Button } from '../ui/Button';
import styles from './Canvas.module.css';
import type { CanvasItem, Asset } from '@/types';

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface CanvasProps {
  showTimeline?: boolean;
}

export const Canvas: React.FC<CanvasProps> = ({ showTimeline: _showTimeline = false }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
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
    snapshot,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCanvasStore();

  const { getAsset, getAssetsByLineage, getAssetsByParentId, updateAsset } = useFileStore();
  const { settings } = useSettingsStore();
  const log = useLogStore((s) => s.log);

  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(settings.showGrid);
  const [promptOverlayItemId, setPromptOverlayItemId] = useState<string | null>(null);
  const [versionOverlayItemId, setVersionOverlayItemId] = useState<string | null>(null);
  
  // Editable filename tag state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Handle double-click on filename tag to start editing
  const handleTagDoubleClick = useCallback((e: React.MouseEvent, item: CanvasItem) => {
    e.stopPropagation();
    setEditingItemId(item.id);
    setEditingName(item.name);
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (editingItemId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingItemId]);

  // Handle saving the edited name
  const handleSaveName = useCallback(() => {
    if (editingItemId && editingName.trim()) {
      updateItem(editingItemId, { name: editingName.trim() });
      log('canvas_move', `Renamed item to: ${editingName.trim()}`);
    }
    setEditingItemId(null);
    setEditingName('');
  }, [editingItemId, editingName, updateItem, log]);

  // Handle click outside to stop editing
  useEffect(() => {
    if (!editingItemId) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`.${styles.filenameEditInput}`)) {
        handleSaveName();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingItemId, handleSaveName]);

  // Handle keyboard events for editing
  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setEditingItemId(null);
      setEditingName('');
    }
  }, [handleSaveName]);

  // Resize state
  const [resizingHandle, setResizingHandle] = useState<ResizeHandle | null>(null);
  const [resizingItemId, setResizingItemId] = useState<string | null>(null);
  const resizeOrigin = useRef<{ mouseX: number; mouseY: number; item: CanvasItem } | null>(null);

  // Keyboard shortcuts
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
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        undo();
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
  }, [selectedIds, removeSelected, clearSelection, copy, paste, zoomIn, zoomOut, resetViewport, undo, redo, log]);

  // Handle drop from explorer
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left - viewport.x) / viewport.zoom;
      const y = (e.clientY - rect.top - viewport.y) / viewport.zoom;

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
            // Scale dropped images to a reasonable size for the viewport
            const maxDim = Math.min(320, Math.round(window.innerWidth * 0.2));
            const scaleFactor = Math.min(1, maxDim / Math.max(img.width, img.height));
            addItem({
              type: 'image',
              x: x + index * 20,
              y: y + index * 20,
              width: img.width,
              height: img.height,
              rotation: 0,
              scale: scaleFactor,
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

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains(styles.canvasContent)) {
        clearSelection();
        setPromptOverlayItemId(null);
        setVersionOverlayItemId(null);
      }
    },
    [clearSelection]
  );

  // Item drag start — take snapshot for undo
  const handleItemMouseDown = useCallback(
    (e: React.MouseEvent, item: CanvasItem) => {
      e.stopPropagation();
      if (item.locked) return;

      snapshot(); // Snapshot before move for undo

      selectItem(item.id, e.shiftKey || e.metaKey);
      bringToFront(item.id);

      setDragItemId(item.id);
      setDragStart({
        x: e.clientX - item.x * viewport.zoom,
        y: e.clientY - item.y * viewport.zoom,
      });
    },
    [selectItem, bringToFront, viewport.zoom, snapshot]
  );

  // Resize handle mouse down
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, item: CanvasItem, handle: ResizeHandle) => {
      e.stopPropagation();
      e.preventDefault();
      if (item.locked) return;

      snapshot(); // Snapshot before resize for undo

      setResizingHandle(handle);
      setResizingItemId(item.id);
      resizeOrigin.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        item: { ...item },
      };
    },
    [snapshot]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragItemId) {
        const newX = (e.clientX - dragStart.x) / viewport.zoom;
        const newY = (e.clientY - dragStart.y) / viewport.zoom;
        updateItem(dragItemId, { x: newX, y: newY });
      } else if (resizingItemId && resizingHandle && resizeOrigin.current) {
        const { mouseX, mouseY, item: orig } = resizeOrigin.current;
        const dx = (e.clientX - mouseX) / viewport.zoom;
        const dy = (e.clientY - mouseY) / viewport.zoom;
        const origW = orig.width * orig.scale;
        const origH = orig.height * orig.scale;

        let newX = orig.x;
        let newY = orig.y;
        let newW = origW;
        let newH = origH;

        const handle = resizingHandle;

        if (handle.includes('e')) newW = Math.max(32, origW + dx);
        if (handle.includes('s')) newH = Math.max(32, origH + dy);
        if (handle.includes('w')) {
          newW = Math.max(32, origW - dx);
          newX = orig.x + origW - newW;
        }
        if (handle.includes('n')) {
          newH = Math.max(32, origH - dy);
          newY = orig.y + origH - newH;
        }

        updateItem(resizingItemId, {
          x: newX,
          y: newY,
          width: newW,
          height: newH,
          scale: 1,
        });
      } else if (isPanning) {
        setViewport({
          x: viewport.x + e.movementX,
          y: viewport.y + e.movementY,
        });
      }
    },
    [dragItemId, dragStart, viewport, isPanning, updateItem, resizingItemId, resizingHandle]
  );

  const handleMouseUp = useCallback(() => {
    if (dragItemId) {
      log('canvas_move', 'Moved item on canvas');
    }
    if (resizingItemId) {
      log('canvas_resize', 'Resized item on canvas');
    }
    setDragItemId(null);
    setIsPanning(false);
    setResizingHandle(null);
    setResizingItemId(null);
    resizeOrigin.current = null;
  }, [dragItemId, resizingItemId, log]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
    }
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Zoom toward mouse position
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(5, Math.max(0.1, viewport.zoom * delta));
        const zoomFactor = newZoom / viewport.zoom;

        setViewport({
          zoom: newZoom,
          x: mouseX - zoomFactor * (mouseX - viewport.x),
          y: mouseY - zoomFactor * (mouseY - viewport.y),
        });
      } else {
        setViewport({
          x: viewport.x - e.deltaX,
          y: viewport.y - e.deltaY,
        });
      }
    },
    [viewport, setViewport]
  );

  // Export canvas as PNG using an offscreen canvas
  const handleExport = useCallback(async () => {
    if (items.length === 0) return;

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    items.forEach((item) => {
      const w = item.width * item.scale;
      const h = item.height * item.scale;
      minX = Math.min(minX, item.x);
      minY = Math.min(minY, item.y);
      maxX = Math.max(maxX, item.x + w);
      maxY = Math.max(maxY, item.y + h);
    });

    const padding = 40;
    const exportW = maxX - minX + padding * 2;
    const exportH = maxY - minY + padding * 2;

    const offscreen = document.createElement('canvas');
    offscreen.width = exportW;
    offscreen.height = exportH;
    const ctx = offscreen.getContext('2d')!;

    // Dark background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, exportW, exportH);

    // Sort by zIndex
    const sorted = [...items].sort((a, b) => a.zIndex - b.zIndex);

    for (const item of sorted) {
      if (!item.visible || !item.src) continue;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve) => {
        img.onload = () => {
          const x = item.x - minX + padding;
          const y = item.y - minY + padding;
          const w = item.width * item.scale;
          const h = item.height * item.scale;
          ctx.save();
          ctx.translate(x + w / 2, y + h / 2);
          ctx.rotate((item.rotation * Math.PI) / 180);
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
          ctx.restore();
          resolve();
        };
        img.onerror = () => resolve();
        img.src = item.src!;
      });
    }

    offscreen.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'canvas-export.png';
      a.click();
      URL.revokeObjectURL(url);
      log('project_export', 'Exported canvas as PNG');
    }, 'image/png');
  }, [items, log]);

  const handleRotateCCW = useCallback(() => {
    const selected = useCanvasStore.getState().getSelectedItems();
    if (selected.length === 0) return;
    snapshot();
    selected.forEach((item) => {
      updateItem(item.id, { rotation: (item.rotation - 15 + 360) % 360 });
    });
  }, [updateItem, snapshot]);

  const handleRotateCW = useCallback(() => {
    const selected = useCanvasStore.getState().getSelectedItems();
    if (selected.length === 0) return;
    snapshot();
    selected.forEach((item) => {
      updateItem(item.id, { rotation: (item.rotation + 15) % 360 });
    });
  }, [updateItem, snapshot]);

  // Cursor based on operation
  const getCursor = () => {
    if (resizingHandle) {
      const map: Record<ResizeHandle, string> = {
        nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
        e: 'e-resize', se: 'se-resize', s: 's-resize',
        sw: 'sw-resize', w: 'w-resize',
      };
      return map[resizingHandle];
    }
    if (isPanning) return 'grabbing';
    if (dragItemId) return 'grabbing';
    return 'default';
  };

  return (
    <div className={styles.canvasWrapper}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo()} title="Undo (⌘Z)">
            <Undo2 size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo()} title="Redo (⌘⇧Z)">
            <Redo2 size={16} />
          </Button>
        </div>

        <div className={styles.toolbarDivider} />

        <div className={styles.toolbarGroup}>
          <Button variant="ghost" size="sm" onClick={zoomOut} title="Zoom Out (-)">
            <ZoomOut size={16} />
          </Button>
          <span className={styles.zoomLevel}>{Math.round(viewport.zoom * 100)}%</span>
          <Button variant="ghost" size="sm" onClick={zoomIn} title="Zoom In (+)">
            <ZoomIn size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={resetViewport} title="Reset View (0)">
            <Maximize size={16} />
          </Button>
        </div>

        <div className={styles.toolbarDivider} />

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

        {selectedIds.length > 0 && (
          <>
            <div className={styles.toolbarDivider} />
            <div className={styles.toolbarGroup}>
              <Button variant="ghost" size="sm" onClick={handleRotateCCW} title="Rotate CCW">
                <RotateCcw size={16} />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRotateCW} title="Rotate CW">
                <RotateCw size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { copy(); paste(); }}
                title="Duplicate"
              >
                <Copy size={16} />
              </Button>
              <Button variant="ghost" size="sm" onClick={removeSelected} title="Delete (⌫)">
                <Trash2 size={16} />
              </Button>
            </div>
          </>
        )}

        <div className={styles.toolbarSpacer} />

        <div className={styles.toolbarGroup}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            disabled={items.length === 0}
            title="Export as PNG"
          >
            <Download size={16} />
          </Button>
        </div>

        <div className={styles.itemCount}>
          {items.length} item{items.length !== 1 ? 's' : ''}
          {selectedIds.length > 0 && ` · ${selectedIds.length} selected`}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className={`${styles.canvas} ${isDragging ? styles.dropTarget : ''} ${showGrid ? styles.showGrid : ''}`}
        style={{ cursor: getCursor() }}
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
              className={`${styles.canvasItem} ${selectedIds.includes(item.id) ? styles.selected : ''} ${item.locked ? styles.locked : ''}`}
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

              {/* Resize + selection handles */}
              {selectedIds.includes(item.id) && !item.locked && (
                <>
                  {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as ResizeHandle[]).map((h) => (
                    <div
                      key={h}
                      className={`${styles.handle} ${styles[`handle${h.toUpperCase().replace('-', '')}`]}`}
                      onMouseDown={(e) => handleResizeMouseDown(e, item, h)}
                    />
                  ))}
                </>
              )}

              {item.locked && (
                <div className={styles.lockIndicator}>
                  <span style={{ fontSize: '10px' }}>🔒</span>
                </div>

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

                {/* Link indicators */}
                {hasParent && (
                  <div className={`${styles.linkDot} ${styles.linkDotLeft}`} title="Linked to parent" />
                )}
                {hasChildren && (
                  <div className={`${styles.linkDot} ${styles.linkDotRight}`} title={`${children.length} linked outputs`}>
                    {children.length}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {items.length === 0 && (
          <div className={styles.emptyState}>
            <Layers size={48} />
            <h3>Start by generating an image or importing assets</h3>
            <p>
              Drag images from the Explorer panel or your computer, or generate
              new images using the Inspector panel.
            </p>
          </div>
        )}

        {isDragging && (
          <div className={styles.dropIndicator}>
            <span>Drop to add to canvas</span>
          </div>
        )}
      </div>
    </div>
  );
};
