import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid3X3,
  Lock,
  Link2,
  Trash2,
  Copy,
  Layers,
  ImageOff,
  FileText,
} from 'lucide-react';
import { useCanvasStore, useFileStore, useLogStore, useSettingsStore } from '@/stores';
import { Button } from '../ui/Button';
import styles from './Canvas.module.css';
import type { CanvasItem, Asset } from '@/types';

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

  // Handle canvas click (deselect)
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

  const handleLinkSelected = useCallback(() => {
    if (selectedIds.length < 2) return;

    const parentItem = items.find((i) => i.id === selectedIds[0]);
    if (!parentItem) return;

    const parentAsset = parentItem.assetId ? getAsset(parentItem.assetId) : undefined;
    const lineageId = parentAsset?.metadata?.lineageId || parentAsset?.id || parentItem.assetId || parentItem.id;
    const parentRefId = parentItem.assetId || parentItem.id;

    selectedIds.slice(1).forEach((childId) => {
      const childItem = items.find((i) => i.id === childId);
      updateItem(childId, {
        parentAssetId: parentRefId,
        lineageId,
      });

      if (childItem?.assetId) {
        const childAsset = getAsset(childItem.assetId);
        updateAsset(childItem.assetId, {
          metadata: {
            ...childAsset?.metadata,
            parentAssetId: parentRefId,
            lineageId,
          },
        });
      }
    });

    log('canvas_move', `Linked ${selectedIds.length} items`);
  }, [items, selectedIds, getAsset, updateAsset, updateItem, log]);

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

  // Tag counter-scale: inversely proportional to zoom, dampened with sqrt
  // so tags don't grow too large when zoomed out or vanish when zoomed in.
  // Clamped between 0.5x (zoomed in) and 2.5x (zoomed out).
  const tagScale = Math.min(2.5, Math.max(0.5, 1 / Math.pow(viewport.zoom, 0.5)));

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
              {selectedIds.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLinkSelected}
                  title="Link selected items"
                >
                  <Link2 size={16} />
                </Button>
              )}
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
          {items.map((item) => {
            const asset = item.assetId ? getAsset(item.assetId) : undefined;
            const isPromptItem = item.type === 'placeholder' || asset?.type === 'prompt';
            const promptText = asset?.metadata?.prompt || item.prompt || '';
            const versionLabel = asset?.metadata?.version || item.version || '1.0';
            const lineageId = asset?.metadata?.lineageId || item.lineageId;
            const lineageAssets = lineageId ? getAssetsByLineage(lineageId) : [];
            const children = asset?.id ? getAssetsByParentId(asset.id) : [];
            const hasParent = Boolean(asset?.metadata?.parentAssetId || item.parentAssetId);
            const hasChildren = children.length > 0;
            const versionOptions = lineageAssets
              .map((entry) => ({
                id: entry.id,
                version: entry.metadata?.version || '1.0',
                src: entry.thumbnail || '',
                name: entry.name,
                prompt: entry.metadata?.prompt,
                model: entry.metadata?.model,
              }))
              .sort((a, b) => {
                const [aMajor, aMinor = '0'] = a.version.split('.');
                const [bMajor, bMinor = '0'] = b.version.split('.');
                const majorDiff = Number(aMajor) - Number(bMajor);
                return majorDiff !== 0 ? majorDiff : Number(aMinor) - Number(bMinor);
              });
            // Check if item has a valid src and hasn't failed to load
            const hasValidSrc = item.src && item.src.length > 10 && !failedImages.has(item.id);
            
            // Debug log for each item
            if (process.env.NODE_ENV === 'development' && item.src) {
              console.log(`[Canvas] Rendering item: ${item.name}`, {
                hasSrc: !!item.src,
                srcLength: item.src?.length,
                srcType: item.src?.slice(0, 30),
                isFailed: failedImages.has(item.id),
                willShowImage: hasValidSrc,
              });
            }
            
            return (
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
                {/* Filename + prompt/version tags */}
                {settings.appearance?.showFilenames !== false && (
                  editingItemId === item.id ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      className={styles.filenameEditInput}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onBlur={handleSaveName}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div 
                      className={styles.tagRow}
                      style={{
                        transform: `scale(${tagScale})`,
                        transformOrigin: 'bottom left',
                      }}
                    >
                      <div 
                        className={styles.filenameTag} 
                        title={`${item.name} (double-click to rename)`}
                        onDoubleClick={(e) => handleTagDoubleClick(e, item)}
                      >
                        {item.name.length > 30 ? `${item.name.slice(0, 27)}...` : item.name}
                      </div>
                      {promptText && (
                        <button
                          className={styles.promptTag}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPromptOverlayItemId(promptOverlayItemId === item.id ? null : item.id);
                            setVersionOverlayItemId(null);
                          }}
                          title="View prompt"
                        >
                          Prompt
                        </button>
                      )}
                      <button
                        className={styles.versionTag}
                        onClick={(e) => {
                          e.stopPropagation();
                          setVersionOverlayItemId(versionOverlayItemId === item.id ? null : item.id);
                          setPromptOverlayItemId(null);
                        }}
                        title="Select version"
                      >
                        v{versionLabel}
                      </button>
                    </div>
                  )
                )}

                {/* Prompt overlay */}
                {promptOverlayItemId === item.id && promptText && (
                  <div
                    className={styles.promptOverlay}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={styles.promptTitle}>Prompt</div>
                    <div className={styles.promptText}>{promptText}</div>
                  </div>
                )}

                {/* Version overlay */}
                {versionOverlayItemId === item.id && (
                  <div
                    className={styles.versionOverlay}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={styles.versionTitle}>Versions</div>
                    <div className={styles.versionList}>
                      {versionOptions.length > 0 ? (
                        versionOptions.map((option) => (
                          <button
                            key={option.id}
                            className={`${styles.versionOption} ${
                              option.id === item.assetId ? styles.versionActive : ''
                            }`}
                            onClick={() => {
                              if (!option.src) return;
                              updateItem(item.id, {
                                assetId: option.id,
                                src: option.src,
                                name: option.name,
                                prompt: option.prompt || item.prompt,
                                version: option.version,
                                lineageId,
                              });
                              setVersionOverlayItemId(null);
                            }}
                          >
                            <span className={styles.versionBadge}>v{option.version}</span>
                            <span className={styles.versionName}>
                              {option.name}
                              {option.model ? ` · ${option.model}` : ''}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className={styles.versionEmpty}>No versions found</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Content wrapper */}
                <div className={styles.itemContent}>
                  {isPromptItem && promptText ? (
                    /* Prompt card: show prompt text as a styled note */
                    <div className={styles.promptCard}>
                      <div className={styles.promptCardIcon}>
                        <FileText size={18} />
                      </div>
                      <div className={styles.promptCardText}>
                        {promptText}
                      </div>
                    </div>
                  ) : hasValidSrc ? (
                    <img
                      src={item.src}
                      alt={item.name}
                      className={styles.itemImage}
                      draggable={false}
                      onError={() => {
                        console.error(`[Canvas] Failed to load image: ${item.name}`, {
                          srcPreview: item.src?.slice(0, 100),
                          srcLength: item.src?.length,
                        });
                        setFailedImages(prev => new Set(prev).add(item.id));
                      }}
                      onLoad={() => {
                        console.log(`[Canvas] Image loaded successfully: ${item.name}`);
                        if (failedImages.has(item.id)) {
                          setFailedImages(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(item.id);
                            return newSet;
                          });
                        }
                      }}
                    />
                  ) : (
                    <div className={styles.placeholder}>
                      {failedImages.has(item.id) ? (
                        <>
                          <ImageOff size={32} />
                          <span>Failed to load</span>
                          <span className={styles.placeholderName}>{item.name}</span>
                        </>
                      ) : !item.src ? (
                        <>
                          <Layers size={32} />
                          <span>Blueprint</span>
                          <span className={styles.placeholderName}>{item.name}</span>
                        </>
                      ) : (
                        <>
                          <Layers size={32} />
                          <span>Loading...</span>
                          <span className={styles.placeholderName}>{item.name}</span>
                        </>
                      )}
                    </div>
                  )}
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
