import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
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
  Lock,
  MessageSquareText,
  Cpu,
  GitBranch,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  Sparkles,
  BoxSelect,
  MousePointer2,
  Hand,
  Film,
  Headphones,
  Music,
} from 'lucide-react';
import { useCanvasStore, useFileStore, useLogStore, useSettingsStore, useNodeStore } from '@/stores';
import { Button } from '../ui/Button';
import styles from './Canvas.module.css';
import nodeStyles from './NodeGraph.module.css';
import { NodeCard, ConnLine } from './NodeComponents';
import type { CanvasItem, Asset, GenerationMeta } from '@/types';

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Which secondary tabs have real content (name row is handled separately). */
function getNodeTabVisibility(item: CanvasItem, meta: GenerationMeta | undefined) {
  const promptText = (meta?.prompt || item.prompt || '').trim();
  const neg = (meta?.negativePrompt || '').trim();
  const hasPrompt = !!(promptText || neg);

  const hasInfo = !!(
    meta?.model ||
    meta?.seed != null ||
    meta?.generatedAt ||
    (meta?.parentIds && meta.parentIds.length > 0) ||
    (meta?.childIds && meta.childIds.length > 0) ||
    item.mediaMeta?.duration != null ||
    item.mediaMeta?.mimeType ||
    item.mediaMeta?.codec ||
    item.mediaMeta?.fps != null ||
    item.mediaMeta?.bitRate != null ||
    item.mediaMeta?.channels != null ||
    item.mediaMeta?.sampleRate != null ||
    item.type === 'video' ||
    item.type === 'audio'
  );

  const hasVersions = !!(
    (meta?.variations && meta.variations.length > 0) ||
    (meta?.imageVersion != null && meta.imageVersion > 1) ||
    meta?.filePath
  );

  return { hasPrompt, hasInfo, hasVersions };
}

function resolveActiveNodeTab(
  raw: 'name' | 'prompt' | 'info' | 'versions' | null | undefined,
  vis: ReturnType<typeof getNodeTabVisibility>,
): 'name' | 'prompt' | 'info' | 'versions' | null {
  if (!raw) return null;
  if (raw === 'name') return 'name';
  if (raw === 'prompt' && vis.hasPrompt) return 'prompt';
  if (raw === 'info' && vis.hasInfo) return 'info';
  if (raw === 'versions' && vis.hasVersions) return 'versions';
  return null;
}

function formatMediaDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

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

  const { nodes, connections } = useNodeStore();

  const { getAsset, getAssetsByLineage, getAssetsByParentId, updateAsset } = useFileStore();
  const { settings } = useSettingsStore();
  const log = useLogStore((s) => s.log);

  type CanvasTool = 'pointer' | 'lasso' | 'hand';
  const [activeTool, setActiveTool] = useState<CanvasTool>('pointer');
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  type LassoPhase = 'idle' | 'drawing';
  const [lassoPhase, setLassoPhase] = useState<LassoPhase>('idle');
  const [marqueeStart, setMarqueeStart] = useState({ x: 0, y: 0 });
  const [marqueeEnd, setMarqueeEnd] = useState({ x: 0, y: 0 });
  const lassoJustFinishedRef = useRef(false);

  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(settings.showGrid);
  const [promptOverlayItemId, setPromptOverlayItemId] = useState<string | null>(null);
  const [versionOverlayItemId, setVersionOverlayItemId] = useState<string | null>(null);
  
  // Editable filename tag state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Tab state for all canvas nodes: map of itemId -> activeTab
  type NodeTabId = 'name' | 'prompt' | 'info' | 'versions';
  const [activeNodeTabs, setActiveNodeTabs] = useState<Record<string, NodeTabId | null>>({});
  // Orb expanded state: map of itemId -> boolean
  const [orbExpanded, setOrbExpanded] = useState<Record<string, boolean>>({});
  // Orb spin animation key
  const [orbSpinKey, setOrbSpinKey] = useState<Record<string, number>>({});

  const NODE_COLORS: Record<string, string> = {
    generated: '#00d4aa',
    image: '#a855f7',
    video: '#3b82f6',
    audio: '#f59e0b',
    text: '#10b981',
    placeholder: '#6b7280',
    template: '#eab308',
  };

  const getOrbColor = (type: string) => NODE_COLORS[type] ?? '#00d4aa';

  const maxZIndex = useMemo(
    () => Math.max(0, ...items.map((i) => i.zIndex)),
    [items],
  );

  const toggleNodeTab = useCallback((itemId: string, tab: NodeTabId) => {
    setActiveNodeTabs((prev) => ({
      ...prev,
      [itemId]: prev[itemId] === tab ? null : tab,
    }));
  }, []);

  const toggleOrb = useCallback((itemId: string) => {
    setOrbExpanded((prev) => {
      const next = { ...prev, [itemId]: !prev[itemId] };
      if (!prev[itemId]) {
        setActiveNodeTabs((t) => ({ ...t, [itemId]: null }));
      }
      return next;
    });
    setOrbSpinKey((prev) => ({ ...prev, [itemId]: (prev[itemId] ?? 0) + 1 }));
  }, []);

  const computeTabsMaxWidth = useCallback(
    (itemW: number) => {
      const screenW = typeof window !== 'undefined' ? window.innerWidth : 1920;
      const nodeVisualW = itemW * viewport.zoom;
      return Math.max(120, Math.min(nodeVisualW * 0.95, screenW * 0.35, 600));
    },
    [viewport.zoom],
  );

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

  const spaceHeldRef = useRef(false);
  const toolBeforeSpaceRef = useRef<CanvasTool>('pointer');

  const switchTool = useCallback((tool: CanvasTool) => {
    setActiveTool(tool);
    setLassoPhase('idle');
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === ' ' && !e.repeat && !spaceHeldRef.current) {
        e.preventDefault();
        spaceHeldRef.current = true;
        toolBeforeSpaceRef.current = activeTool;
        switchTool('hand');
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          removeSelected();
          log('canvas_remove', `Removed ${selectedIds.length} item(s)`);
        }
        const selectedNodeIds = useNodeStore.getState().selectedIds;
        if (selectedNodeIds.length > 0) {
          selectedNodeIds.forEach(id => useNodeStore.getState().removeNode(id));
        }
      } else if (e.key === 'Escape') {
        if (lassoPhase === 'drawing') {
          setLassoPhase('idle');
        } else {
          clearSelection();
          useNodeStore.getState().clearSelection();
          useNodeStore.getState().cancelConnection();
        }
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
      } else if (e.key === 'l' || e.key === 'L') {
        switchTool(activeTool === 'lasso' ? 'pointer' : 'lasso');
      } else if (e.key === 'v' || e.key === 'V') {
        switchTool('pointer');
      } else if (e.key === 'h' || e.key === 'H') {
        switchTool('hand');
      } else if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-') {
        zoomOut();
      } else if (e.key === '0') {
        resetViewport();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' && spaceHeldRef.current) {
        spaceHeldRef.current = false;
        switchTool(toolBeforeSpaceRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedIds, removeSelected, clearSelection, copy, paste, zoomIn, zoomOut, resetViewport, undo, redo, log, activeTool, lassoPhase, switchTool]);

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
      if (lassoJustFinishedRef.current) return;

      const target = e.target as HTMLElement;
      const isBackground = target === canvasRef.current || target.classList.contains(styles.canvasContent);
      if (!isBackground) return;

      if (activeTool === 'lasso') {
        if (lassoPhase === 'idle') {
          setMarqueeStart({ x: e.clientX, y: e.clientY });
          setMarqueeEnd({ x: e.clientX, y: e.clientY });
          setLassoPhase('drawing');
        } else if (lassoPhase === 'drawing') {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            const sx = (Math.min(marqueeStart.x, e.clientX) - rect.left - viewport.x) / viewport.zoom;
            const sy = (Math.min(marqueeStart.y, e.clientY) - rect.top - viewport.y) / viewport.zoom;
            const ex = (Math.max(marqueeStart.x, e.clientX) - rect.left - viewport.x) / viewport.zoom;
            const ey = (Math.max(marqueeStart.y, e.clientY) - rect.top - viewport.y) / viewport.zoom;
            const newSelected = items.filter((item) => {
              const iw = item.width * item.scale;
              const ih = item.height * item.scale;
              return item.x + iw > sx && item.x < ex && item.y + ih > sy && item.y < ey;
            }).map((item) => item.id);
            useCanvasStore.setState({ selectedIds: newSelected });
            if (newSelected.length > 0) {
              log('canvas_move', `Selected ${newSelected.length} item(s) via lasso`);
            }
          }
          setLassoPhase('idle');
          lassoJustFinishedRef.current = true;
          setTimeout(() => { lassoJustFinishedRef.current = false; }, 100);
        }
        return;
      }

      if (activeTool === 'pointer') {
        clearSelection();
        useNodeStore.getState().clearSelection();
        setPromptOverlayItemId(null);
        setVersionOverlayItemId(null);
      }
    },
    [clearSelection, activeTool, lassoPhase, marqueeStart, viewport, items, log]
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
      } else if (lassoPhase === 'drawing') {
        setMarqueeEnd({ x: e.clientX, y: e.clientY });
      } else if (isPanning) {
        setViewport({
          x: viewport.x + e.movementX,
          y: viewport.y + e.movementY,
        });
      }
    },
    [dragItemId, dragStart, viewport, isPanning, lassoPhase, updateItem, resizingItemId, resizingHandle, setViewport]
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
      return;
    }
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    const isBackground = target === canvasRef.current || target.classList.contains(styles.canvasContent);
    if (!isBackground) return;

    if (activeTool === 'hand') {
      setIsPanning(true);
    }
  }, [activeTool]);

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
    if (activeTool === 'lasso') return 'crosshair';
    if (activeTool === 'hand') return 'grab';
    return 'default';
  };

  // SVG dimensions for node connections
  const svgW = 10000;
  const svgH = 10000;

  const toolbarScrollRef = useRef<HTMLDivElement>(null);
  const toolbarDragRef = useRef<{ isDragging: boolean; startX: number; scrollLeft: number }>({
    isDragging: false, startX: 0, scrollLeft: 0,
  });

  const handleToolbarPointerDown = useCallback((e: React.PointerEvent) => {
    const el = toolbarScrollRef.current;
    if (!el) return;
    if ((e.target as HTMLElement).closest('button')) return;
    toolbarDragRef.current = { isDragging: true, startX: e.clientX, scrollLeft: el.scrollLeft };
    el.setPointerCapture(e.pointerId);
  }, []);

  const handleToolbarPointerMove = useCallback((e: React.PointerEvent) => {
    const d = toolbarDragRef.current;
    if (!d.isDragging) return;
    const el = toolbarScrollRef.current;
    if (!el) return;
    el.scrollLeft = d.scrollLeft - (e.clientX - d.startX);
  }, []);

  const handleToolbarPointerUp = useCallback(() => {
    toolbarDragRef.current.isDragging = false;
  }, []);

  return (
    <div className={styles.canvasWrapper}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div
          ref={toolbarScrollRef}
          className={styles.toolbarScroll}
          onPointerDown={handleToolbarPointerDown}
          onPointerMove={handleToolbarPointerMove}
          onPointerUp={handleToolbarPointerUp}
          onPointerCancel={handleToolbarPointerUp}
        >
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
            <Button
              variant={activeTool === 'pointer' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => switchTool('pointer')}
              title="Pointer (V)"
            >
              <MousePointer2 size={16} />
            </Button>
            <Button
              variant={activeTool === 'lasso' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => switchTool(activeTool === 'lasso' ? 'pointer' : 'lasso')}
              title="Lasso Select (L)"
              className={activeTool === 'lasso' ? styles.toolButtonActive : undefined}
            >
              <BoxSelect size={16} />
            </Button>
            <Button
              variant={activeTool === 'hand' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => switchTool(activeTool === 'hand' ? 'pointer' : 'hand')}
              title="Hand / Pan (H)"
            >
              <Hand size={16} />
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
          {/* Node Connections Layer */}
          <svg
            className={nodeStyles.connSvg}
            width={svgW}
            height={svgH}
            style={{ left: -svgW / 2, top: -svgH / 2 }}
          >
            <g transform={`translate(${svgW / 2}, ${svgH / 2})`}>
              {connections.map((conn) => (
                <ConnLine key={conn.id} conn={conn} nodes={nodes} zoom={viewport.zoom} />
              ))}
            </g>
          </svg>

          {/* Canvas Items */}
          {items.map((item) => {
            const isGenerated = item.type === 'generated';
            const meta = item.generationMeta;
            const rawTab = activeNodeTabs[item.id] ?? null;
            const tabVis = getNodeTabVisibility(item, meta);
            const activeTab = resolveActiveNodeTab(rawTab, tabVis);
            const isOrbOpen = orbExpanded[item.id] ?? false;
            const orbColor = getOrbColor(item.type);
            const isHighestZ = item.zIndex === maxZIndex && items.length > 1;
            const tabsMaxW = computeTabsMaxWidth(item.width * item.scale);
            const orbSpinClass = orbSpinKey[item.id] ? styles.nodeOrbSpin : '';

            return (
              <div
                key={item.id}
                data-canvas-item-id={item.id}
                className={`${styles.canvasItem} ${selectedIds.includes(item.id) ? styles.selected : ''} ${item.locked ? styles.locked : ''} ${isHighestZ ? styles.nodeFrameHighZ : ''}`}
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.width * item.scale,
                  height: item.height * item.scale,
                  transform: `rotate(${item.rotation}deg)`,
                  zIndex: item.zIndex,
                  opacity: item.visible ? 1 : 0.3,
                  ['--orb-color' as string]: orbColor,
                }}
                onMouseDown={(e) => handleItemMouseDown(e, item)}
              >
                {/* ── Node Orb ── */}
                <div
                  key={`orb-${orbSpinKey[item.id] ?? 0}`}
                  className={`${styles.nodeOrb} ${isOrbOpen ? styles.nodeOrbExpanded : ''} ${orbSpinClass}`}
                  style={{
                    background: orbColor,
                    transform: `scale(${1 / viewport.zoom})`,
                    transformOrigin: 'center center',
                  }}
                  onClick={(e) => { e.stopPropagation(); toggleOrb(item.id); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  title={isOrbOpen ? 'Collapse details' : 'Expand details'}
                >
                  {isOrbOpen ? <ChevronUp /> : <ChevronDown />}
                </div>

                {/* ── Expanded vertical tabs (from orb) ── */}
                {isOrbOpen && (
                  <div
                    className={styles.nodeTabsExpanded}
                    style={{
                      transform: `scale(${1 / viewport.zoom})`,
                      transformOrigin: 'top left',
                      ['--orb-color' as string]: orbColor,
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div
                      className={`${styles.expandedTab} ${activeTab === 'name' ? styles.expandedTabActive : ''}`}
                      onClick={() => toggleNodeTab(item.id, 'name')}
                    >
                      <span className={styles.expandedTabIcon}>
                        {isGenerated ? <Sparkles size={11} /> : item.type === 'video' ? <Film size={11} /> : item.type === 'audio' ? <Headphones size={11} /> : <ImageIcon size={11} />}
                      </span>
                      {item.name}
                    </div>
                    {tabVis.hasPrompt && (
                      <div
                        className={`${styles.expandedTab} ${activeTab === 'prompt' ? styles.expandedTabActive : ''}`}
                        onClick={() => toggleNodeTab(item.id, 'prompt')}
                      >
                        <span className={styles.expandedTabIcon}><MessageSquareText size={11} /></span>
                        Prompt
                      </div>
                    )}
                    {tabVis.hasInfo && (
                      <div
                        className={`${styles.expandedTab} ${activeTab === 'info' ? styles.expandedTabActive : ''}`}
                        onClick={() => toggleNodeTab(item.id, 'info')}
                      >
                        <span className={styles.expandedTabIcon}><Cpu size={11} /></span>
                        Info
                      </div>
                    )}
                    {tabVis.hasVersions && (
                      <div
                        className={`${styles.expandedTab} ${activeTab === 'versions' ? styles.expandedTabActive : ''}`}
                        onClick={() => toggleNodeTab(item.id, 'versions')}
                      >
                        <span className={styles.expandedTabIcon}><GitBranch size={11} /></span>
                        Versions
                      </div>
                    )}
                  </div>
                )}

                {/* ── Expanded panel content ── */}
                {isOrbOpen && activeTab && (
                  <div
                    className={styles.nodeTabPanelExpanded}
                    style={{
                      transform: `scale(${1 / viewport.zoom})`,
                      transformOrigin: 'top left',
                      ['--orb-color' as string]: orbColor,
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {activeTab === 'name' && (
                      <>
                        <div className={styles.nodeTabPanelLabel}>Name</div>
                        {editingItemId === item.id ? (
                          <input
                            ref={editInputRef}
                            className={styles.filenameEditInput}
                            style={{ position: 'static', width: '100%', maxWidth: '100%' }}
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                            onBlur={handleSaveName}
                          />
                        ) : (
                          <div
                            className={styles.nodeTabPanelValue}
                            onDoubleClick={(e) => handleTagDoubleClick(e, item)}
                            style={{ cursor: 'text' }}
                          >
                            {item.name}
                          </div>
                        )}
                        <div className={styles.nodeTabPanelRow} style={{ marginTop: 6 }}>
                          <span className={styles.nodeTabPanelLabel}>Type</span>
                          <span className={styles.nodeTabPanelValue}>
                            {isGenerated
                              ? 'AI Generated'
                              : item.type === 'image'
                                ? 'Imported Image'
                                : item.type === 'video'
                                  ? 'Video'
                                  : item.type === 'audio'
                                    ? 'Audio'
                                    : item.type === 'text'
                                      ? 'Text'
                                      : item.type === 'template'
                                        ? 'Prompt Template'
                                        : 'Placeholder'}
                          </span>
                        </div>
                        <div className={styles.nodeTabPanelRow}>
                          <span className={styles.nodeTabPanelLabel}>Size</span>
                          <span className={styles.nodeTabPanelValue}>{Math.round(item.width * item.scale)} × {Math.round(item.height * item.scale)}</span>
                        </div>
                        <div className={styles.nodeTabPanelRow}>
                          <span className={styles.nodeTabPanelLabel}>Position</span>
                          <span className={styles.nodeTabPanelValue}>{Math.round(item.x)}, {Math.round(item.y)}</span>
                        </div>
                        {item.assetId && (
                          <div className={styles.nodeTabPanelRow}>
                            <span className={styles.nodeTabPanelLabel}>Asset ID</span>
                            <span className={styles.nodeTabPanelValue} style={{ fontSize: '0.5625rem', opacity: 0.6 }}>{item.assetId.slice(0, 14)}…</span>
                          </div>
                        )}
                      </>
                    )}
                    {activeTab === 'prompt' && (
                      <>
                        <div className={styles.nodeTabPanelLabel}>Prompt</div>
                        <div className={styles.nodeTabPanelValue}>
                          {meta?.prompt || item.prompt || '—'}
                        </div>
                        {meta?.negativePrompt && (
                          <>
                            <div className={styles.nodeTabPanelLabel} style={{ marginTop: 6 }}>Negative Prompt</div>
                            <div className={styles.nodeTabPanelValue}>{meta.negativePrompt}</div>
                          </>
                        )}
                      </>
                    )}
                    {activeTab === 'info' && (
                      <>
                        {item.type === 'video' && (
                          <>
                            {item.mediaMeta?.duration != null && item.mediaMeta.duration > 0 && (
                              <div className={styles.nodeTabPanelRow}>
                                <span className={styles.nodeTabPanelLabel}>Duration</span>
                                <span className={styles.nodeTabPanelValue}>
                                  {formatMediaDuration(item.mediaMeta.duration)}
                                </span>
                              </div>
                            )}
                            {item.mediaMeta?.mimeType && (
                              <div className={styles.nodeTabPanelRow}>
                                <span className={styles.nodeTabPanelLabel}>MIME</span>
                                <span className={styles.nodeTabPanelValue}>{item.mediaMeta.mimeType}</span>
                              </div>
                            )}
                            {item.mediaMeta?.codec && (
                              <div className={styles.nodeTabPanelRow}>
                                <span className={styles.nodeTabPanelLabel}>Codec</span>
                                <span className={styles.nodeTabPanelValue}>{item.mediaMeta.codec}</span>
                              </div>
                            )}
                            {item.mediaMeta?.fps != null && (
                              <div className={styles.nodeTabPanelRow}>
                                <span className={styles.nodeTabPanelLabel}>FPS</span>
                                <span className={styles.nodeTabPanelValue}>{item.mediaMeta.fps}</span>
                              </div>
                            )}
                          </>
                        )}
                        <div className={styles.nodeTabPanelRow}>
                          <span className={styles.nodeTabPanelLabel}>Model</span>
                          <span className={styles.nodeTabPanelValue}>{meta?.model || '—'}</span>
                        </div>
                        <div className={styles.nodeTabPanelRow}>
                          <span className={styles.nodeTabPanelLabel}>Seed</span>
                          <span className={styles.nodeTabPanelValue}>{meta?.seed ?? '—'}</span>
                        </div>
                        <div className={styles.nodeTabPanelRow}>
                          <span className={styles.nodeTabPanelLabel}>Size</span>
                          <span className={styles.nodeTabPanelValue}>{meta?.width || item.width} × {meta?.height || item.height}</span>
                        </div>
                        <div className={styles.nodeTabPanelRow}>
                          <span className={styles.nodeTabPanelLabel}>Generated at</span>
                          <span className={styles.nodeTabPanelValue}>
                            {meta?.generatedAt ? new Date(meta.generatedAt).toLocaleString() : '—'}
                          </span>
                        </div>
                        <div className={styles.nodeTabPanelRow}>
                          <span className={styles.nodeTabPanelLabel}>Parents</span>
                          <span className={styles.nodeTabPanelValue}>
                            {meta?.parentIds?.length ? meta.parentIds.length : 'None (original)'}
                          </span>
                        </div>
                        <div className={styles.nodeTabPanelRow}>
                          <span className={styles.nodeTabPanelLabel}>Children</span>
                          <span className={styles.nodeTabPanelValue}>
                            {meta?.childIds?.length ? meta.childIds.length : 'None'}
                          </span>
                        </div>
                      </>
                    )}
                    {activeTab === 'versions' && (
                      <>
                        <div className={styles.nodeTabPanelRow}>
                          <span className={styles.nodeTabPanelLabel}>Image Version</span>
                          <span className={styles.nodeTabPanelValue}>v{meta?.imageVersion ?? 1}</span>
                        </div>
                        {meta?.filePath && (
                          <div className={styles.nodeTabPanelRow}>
                            <span className={styles.nodeTabPanelLabel}>File</span>
                            <span className={styles.nodeTabPanelValue}>{meta.filePath}</span>
                          </div>
                        )}
                        {meta?.variations && meta.variations.length > 0 ? (
                          <>
                            <div className={styles.nodeTabPanelLabel} style={{ marginTop: 4 }}>Variations</div>
                            {meta.variations.map((v) => (
                              <div key={v.id} className={styles.nodeTabPanelRow}>
                                <span className={styles.nodeTabPanelValue}>{v.label}</span>
                                {v.filePath && <span className={styles.nodeTabPanelLabel}>{v.filePath}</span>}
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className={styles.nodeTabPanelEmpty}>No variations yet</div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ── Compact horizontal tabs (when orb is collapsed) ── */}
                {!isOrbOpen && (() => {
                  const showNameTab = !!(item.name.trim() || editingItemId === item.id);
                  const showSecondary = tabVis.hasPrompt || tabVis.hasInfo || tabVis.hasVersions;
                  if (!showNameTab && !showSecondary) return null;
                  return (
                  <div
                    className={styles.nodeTabs}
                    style={{
                      transform: `scale(${1 / viewport.zoom})`,
                      transformOrigin: 'bottom left',
                      ['--tabs-max-w' as string]: `${tabsMaxW}px`,
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {showNameTab && (
                      editingItemId === item.id ? (
                        <input
                          ref={editInputRef}
                          className={styles.filenameEditInput}
                          style={{ position: 'static', top: 'unset', left: 'unset' }}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={handleEditKeyDown}
                          onBlur={handleSaveName}
                        />
                      ) : (
                        <div
                          className={`${styles.nodeTab} ${!activeTab ? styles.nodeTabActive : ''}`}
                          onDoubleClick={(e) => handleTagDoubleClick(e, item)}
                          title={item.name}
                        >
                          {item.name.length > 24 ? item.name.slice(0, 22) + '…' : item.name}
                        </div>
                      )
                    )}
                    {tabVis.hasPrompt && (
                      <div
                        className={`${styles.nodeTab} ${activeTab === 'prompt' ? styles.nodeTabActive : ''}`}
                        onClick={() => toggleNodeTab(item.id, 'prompt')}
                        title="Prompt"
                      >
                        <MessageSquareText size={9} /> Prompt
                      </div>
                    )}
                    {tabVis.hasInfo && (
                      <div
                        className={`${styles.nodeTab} ${activeTab === 'info' ? styles.nodeTabActive : ''}`}
                        onClick={() => toggleNodeTab(item.id, 'info')}
                        title="Info"
                      >
                        <Cpu size={9} /> Info
                      </div>
                    )}
                    {tabVis.hasVersions && (
                      <div
                        className={`${styles.nodeTab} ${activeTab === 'versions' ? styles.nodeTabActive : ''}`}
                        onClick={() => toggleNodeTab(item.id, 'versions')}
                        title="Versions"
                      >
                        <GitBranch size={9} /> Ver
                      </div>
                    )}
                  </div>
                  );
                })()}

                {/* ── Compact tab panel (when orb is collapsed) ── */}
                {!isOrbOpen && activeTab && (
                  <div
                    className={styles.nodeTabPanel}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {activeTab === 'prompt' && (
                      <>
                        <div className={styles.nodeTabPanelLabel}>Prompt</div>
                        <div className={styles.nodeTabPanelValue}>
                          {meta?.prompt || item.prompt || '—'}
                        </div>
                      </>
                    )}
                    {activeTab === 'info' && (
                      <>
                        {item.type === 'video' && (
                          <>
                            {item.mediaMeta?.duration != null && item.mediaMeta.duration > 0 && (
                              <div className={styles.nodeTabPanelRow}>
                                <span className={styles.nodeTabPanelLabel}>Duration</span>
                                <span className={styles.nodeTabPanelValue}>
                                  {formatMediaDuration(item.mediaMeta.duration)}
                                </span>
                              </div>
                            )}
                            {item.mediaMeta?.mimeType && (
                              <div className={styles.nodeTabPanelRow}>
                                <span className={styles.nodeTabPanelLabel}>MIME</span>
                                <span className={styles.nodeTabPanelValue}>{item.mediaMeta.mimeType}</span>
                              </div>
                            )}
                            {item.mediaMeta?.codec && (
                              <div className={styles.nodeTabPanelRow}>
                                <span className={styles.nodeTabPanelLabel}>Codec</span>
                                <span className={styles.nodeTabPanelValue}>{item.mediaMeta.codec}</span>
                              </div>
                            )}
                          </>
                        )}
                        <div className={styles.nodeTabPanelRow}>
                          <span className={styles.nodeTabPanelLabel}>Model</span>
                          <span className={styles.nodeTabPanelValue}>{meta?.model || '—'}</span>
                        </div>
                        <div className={styles.nodeTabPanelRow}>
                          <span className={styles.nodeTabPanelLabel}>Size</span>
                          <span className={styles.nodeTabPanelValue}>{item.width} × {item.height}</span>
                        </div>
                      </>
                    )}
                    {activeTab === 'versions' && (
                      <div className={styles.nodeTabPanelRow}>
                        <span className={styles.nodeTabPanelLabel}>Version</span>
                        <span className={styles.nodeTabPanelValue}>v{meta?.imageVersion ?? 1}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Media rendering ── */}
                {item.type === 'video' && item.src && (
                  <div className={styles.videoNode}>
                    <div className={styles.videoStack}>
                      <div className={styles.videoStackCard} aria-hidden />
                      <div className={styles.videoStackCard} aria-hidden />
                      <div className={styles.videoStackCover}>
                        <img
                          src={item.src}
                          alt={item.name}
                          className={styles.itemImage}
                          draggable={false}
                        />
                        {item.mediaMeta?.duration != null && item.mediaMeta.duration > 0 && (
                          <span className={styles.videoDuration}>
                            {formatMediaDuration(item.mediaMeta.duration)}
                          </span>
                        )}
                        <div className={styles.videoTypeBadge}><Film size={10} /> VIDEO</div>
                      </div>
                    </div>
                    {isOrbOpen && (
                      <div className={styles.videoTimeBanner}>
                        <div className={styles.videoTimeRuler}>
                          <span className={styles.videoTimeLabel}>0:00</span>
                          <div className={styles.videoTimeTrack} />
                          <span className={styles.videoTimeLabel}>
                            {item.mediaMeta?.duration != null && item.mediaMeta.duration > 0
                              ? formatMediaDuration(item.mediaMeta.duration)
                              : '—'}
                          </span>
                        </div>
                        {item.mediaMeta?.filmstripFrames && item.mediaMeta.filmstripFrames.length > 0 ? (
                          <div className={styles.videoKeyframes}>
                            {item.mediaMeta.filmstripFrames.map((frame, i) => (
                              <button
                                key={i}
                                type="button"
                                className={styles.videoKeyframeSlot}
                                title={`Frame ${i + 1}`}
                              >
                                <img src={frame} alt="" className={styles.videoKeyframeThumb} draggable={false} />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className={styles.videoKeyframesPlaceholder}>
                            Open the asset menu to browse key images when a filmstrip is available for this video.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {item.type === 'audio' && (
                  <div className={styles.audioNode}>
                    {item.src && (
                      <img src={item.src} alt={item.name} className={styles.itemImage} draggable={false} />
                    )}
                    {!item.src && (
                      <div className={styles.audioWaveform}>
                        <Music size={28} />
                        <span className={styles.audioName}>{item.name}</span>
                      </div>
                    )}
                    {item.mediaMeta?.duration != null && item.mediaMeta.duration > 0 && (
                      <span className={styles.videoDuration}>
                        {(() => {
                          const d = item.mediaMeta.duration;
                          const m = Math.floor(d / 60);
                          const s = Math.floor(d % 60);
                          return `${m}:${s.toString().padStart(2, '0')}`;
                        })()}
                      </span>
                    )}
                    <div className={styles.videoTypeBadge} style={{ background: 'rgba(245, 158, 11, 0.85)' }}>
                      <Headphones size={10} /> AUDIO
                    </div>
                  </div>
                )}

                {item.type === 'template' && (
                  <div className={styles.templateNode}>
                    <div className={styles.templateNodeBadge}>
                      <BookOpen size={9} /> TEMPLATE
                    </div>
                    <div className={styles.templateNodeName}>{item.name}</div>
                    {item.prompt && (
                      <div className={styles.templateNodeBody}>
                        {item.prompt.slice(0, 140)}{item.prompt.length > 140 ? '…' : ''}
                      </div>
                    )}
                    {item.prompt && (
                      <div className={styles.templateNodeVars}>
                        {[...new Set((item.prompt.match(/\{\{([^}]+)\}\}/g) ?? []).map((m) => m.slice(2, -2)))].map((v) => (
                          <span key={v} className={styles.templateNodeVar}>{v}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {item.type !== 'video' && item.type !== 'audio' && item.type !== 'template' && item.src && (
                  <img
                    src={item.src}
                    alt={item.name}
                    className={styles.itemImage}
                    draggable={false}
                  />
                )}

                {!item.src && item.type !== 'audio' && item.type !== 'template' && (
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
                    <Lock size={12} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Node Cards Layer */}
          {nodes.map((node) => (
            <div key={node.id} data-node style={{ position: 'absolute', left: 0, top: 0 }}>
              <NodeCard
                node={node}
                zoom={viewport.zoom}
                isSelected={useNodeStore.getState().selectedIds.includes(node.id)}
                connections={connections}
              />
            </div>
          ))}
        </div>

        {items.length === 0 && nodes.length === 0 && (
          <div className={styles.emptyState}>
            <Layers size={48} />
            <h3>Start by generating an image or importing assets</h3>
            <p>
              Drag images from the Explorer panel or your computer, or generate
              new images using the Inspector panel.
            </p>
          </div>
        )}

        {lassoPhase === 'drawing' && (() => {
          const rect = canvasRef.current?.getBoundingClientRect();
          const rLeft = rect?.left ?? 0;
          const rTop = rect?.top ?? 0;
          const mLeft = Math.min(marqueeStart.x, marqueeEnd.x) - rLeft;
          const mTop = Math.min(marqueeStart.y, marqueeEnd.y) - rTop;
          const mW = Math.abs(marqueeEnd.x - marqueeStart.x);
          const mH = Math.abs(marqueeEnd.y - marqueeStart.y);
          let previewCount = 0;
          if (rect && mW > 4 && mH > 4) {
            const sx = (Math.min(marqueeStart.x, marqueeEnd.x) - rLeft - viewport.x) / viewport.zoom;
            const sy = (Math.min(marqueeStart.y, marqueeEnd.y) - rTop - viewport.y) / viewport.zoom;
            const ex = (Math.max(marqueeStart.x, marqueeEnd.x) - rLeft - viewport.x) / viewport.zoom;
            const ey = (Math.max(marqueeStart.y, marqueeEnd.y) - rTop - viewport.y) / viewport.zoom;
            previewCount = items.filter((item) => {
              const iw = item.width * item.scale;
              const ih = item.height * item.scale;
              return item.x + iw > sx && item.x < ex && item.y + ih > sy && item.y < ey;
            }).length;
          }
          return (
            <div className={styles.marqueeRect} style={{ left: mLeft, top: mTop, width: mW, height: mH }}>
              {previewCount > 0 && (
                <span className={styles.marqueeBadge}>{previewCount}</span>
              )}
            </div>
          );
        })()}

        {isDragging && (
          <div className={styles.dropIndicator}>
            <span>Drop to add to canvas</span>
          </div>
        )}
      </div>
    </div>
  );
};
