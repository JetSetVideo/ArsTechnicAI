import React, { useCallback, useRef, useState } from 'react';
import {
  X, MousePointer2, Square, Circle, MoveUpRight, Type as TypeIcon,
  Scan, Ban, Image as ImageIcon, Layers as LayersIcon,
} from 'lucide-react';
import type { AssetLayer, LayerKind, ShapeKind } from '@/types/pipeline';
import { usePipelineStore } from '@/stores/pipelineStore';
import { LayersPanelBody, activeVariantOf } from './LayerSystem';
import styles from './WorkshopFlow.module.css';

type Tool =
  | { id: 'select' }
  | { id: 'shape'; shape: ShapeKind }
  | { id: 'text' }
  | { id: 'mask'; mode: 'include' | 'exclude' }
  | { id: 'image' };

interface DragState {
  kind: 'draw' | 'move' | 'resize';
  layerId?: string;
  startX: number;  // normalized
  startY: number;
  origX?: number;
  origY?: number;
  origW?: number;
  origH?: number;
}

/**
 * Full-screen layer editor over the workshop — Photoshop-inspired:
 * draw forms/masks with the mouse, move/resize layers, collage images,
 * edit text, then flatten or send masked instructions to banana2.
 */
export const LayerEditorModal: React.FC = () => {
  const { editorNodeId, closeEditor, nodes, addLayer, updateLayer } = usePipelineStore();
  const node = nodes.find((n) => n.id === editorNodeId) ?? null;
  const variant = node ? activeVariantOf(node) : undefined;

  const [tool, setTool] = useState<Tool>({ id: 'select' });
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const norm = useCallback((clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const handleStagePointerDown = useCallback((e: React.PointerEvent) => {
    if (!node || !variant) return;
    const p = norm(e.clientX, e.clientY);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (tool.id === 'select') {
      // Hit-test topmost layer under the cursor
      const layers = variant.layers ?? [];
      const hit = [...layers].reverse().find(
        (l) => l.visible && !l.locked && p.x >= l.x && p.x <= l.x + l.w && p.y >= l.y && p.y <= l.y + l.h
      );
      setSelectedLayerId(hit?.id ?? null);
      if (hit) {
        dragRef.current = { kind: 'move', layerId: hit.id, startX: p.x, startY: p.y, origX: hit.x, origY: hit.y };
      }
      return;
    }

    if (tool.id === 'image') { fileRef.current?.click(); return; }

    if (tool.id === 'text') {
      const layer = addLayer(node.id, variant.id, 'text', { x: p.x, y: p.y, w: 0.35, h: 0.1, text: 'New text' });
      setSelectedLayerId(layer.id);
      setTool({ id: 'select' });
      return;
    }

    // Draw shape / mask by dragging
    const kind: LayerKind = tool.id === 'mask' ? 'mask' : 'shape';
    const partial: Partial<AssetLayer> = { x: p.x, y: p.y, w: 0.001, h: 0.001 };
    if (tool.id === 'shape') partial.shape = tool.shape;
    if (tool.id === 'mask') partial.maskMode = tool.mode;
    const layer = addLayer(node.id, variant.id, kind, partial);
    setSelectedLayerId(layer.id);
    dragRef.current = { kind: 'draw', layerId: layer.id, startX: p.x, startY: p.y };
  }, [node, variant, tool, norm, addLayer]);

  const handleStagePointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !node || !variant || !d.layerId) return;
    const p = norm(e.clientX, e.clientY);
    if (d.kind === 'draw') {
      updateLayer(node.id, variant.id, d.layerId, {
        x: Math.min(d.startX, p.x),
        y: Math.min(d.startY, p.y),
        w: Math.max(0.01, Math.abs(p.x - d.startX)),
        h: Math.max(0.01, Math.abs(p.y - d.startY)),
      });
    } else if (d.kind === 'move') {
      updateLayer(node.id, variant.id, d.layerId, {
        x: Math.min(0.99, Math.max(-0.5, (d.origX ?? 0) + (p.x - d.startX))),
        y: Math.min(0.99, Math.max(-0.5, (d.origY ?? 0) + (p.y - d.startY))),
      });
    } else if (d.kind === 'resize') {
      updateLayer(node.id, variant.id, d.layerId, {
        w: Math.max(0.02, (d.origW ?? 0) + (p.x - d.startX)),
        h: Math.max(0.02, (d.origH ?? 0) + (p.y - d.startY)),
      });
    }
  }, [node, variant, norm, updateLayer]);

  const handleStagePointerUp = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.kind === 'draw') setTool({ id: 'select' });
  }, []);

  const startResize = useCallback((e: React.PointerEvent, layer: AssetLayer) => {
    e.stopPropagation();
    if (!stageRef.current) return;
    stageRef.current.setPointerCapture(e.pointerId);
    const p = norm(e.clientX, e.clientY);
    dragRef.current = { kind: 'resize', layerId: layer.id, startX: p.x, startY: p.y, origW: layer.w, origH: layer.h };
  }, [norm]);

  if (!node || !variant) return null;

  const toolBtn = (t: Tool, icon: React.ReactNode, label: string) => {
    const active = JSON.stringify(t) === JSON.stringify(tool);
    return (
      <button
        className={`${styles.editorToolBtn} ${active ? styles.editorToolActive : ''}`}
        title={label}
        onClick={() => setTool(t)}
      >
        {icon}
      </button>
    );
  };

  return (
    <div className={styles.editorOverlay} onPointerDown={(e) => e.stopPropagation()}>
      <div className={styles.editorModal}>
        <div className={styles.editorHeader}>
          <LayersIcon size={15} />
          <span className={styles.editorTitle}>
            {node.title} — v{variant.version ?? 1} · {variant.label}
          </span>
          <div className={styles.editorTools}>
            {toolBtn({ id: 'select' }, <MousePointer2 size={14} />, 'Select / move (V)')}
            {toolBtn({ id: 'shape', shape: 'rectangle' }, <Square size={14} />, 'Draw rectangle')}
            {toolBtn({ id: 'shape', shape: 'ellipse' }, <Circle size={14} />, 'Draw ellipse')}
            {toolBtn({ id: 'shape', shape: 'arrow' }, <MoveUpRight size={14} />, 'Draw arrow')}
            {toolBtn({ id: 'text' }, <TypeIcon size={14} />, 'Place text')}
            {toolBtn({ id: 'mask', mode: 'include' }, <Scan size={14} />, 'Include mask — AI edits inside')}
            {toolBtn({ id: 'mask', mode: 'exclude' }, <Ban size={14} />, 'Exclude mask — AI keeps intact')}
            {toolBtn({ id: 'image' }, <ImageIcon size={14} />, 'Add image (collage)')}
          </div>
          <button className={styles.inspectorClose} onClick={closeEditor} title="Close editor">
            <X size={16} />
          </button>
        </div>

        <div className={styles.editorBody}>
          {/* Interactive stage */}
          <div className={styles.editorStageWrap}>
            <div
              ref={stageRef}
              className={styles.editorStage}
              data-tool={tool.id}
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMove}
              onPointerUp={handleStagePointerUp}
            >
              {variant.image ? (
                <img src={variant.image} alt={variant.label} draggable={false} />
              ) : (
                <div className={styles.previewEmpty}>No picture on this version</div>
              )}
              {/* Interactive layer chrome */}
              {(variant.layers ?? []).map((l) => {
                if (!l.visible) return null;
                const isSel = l.id === selectedLayerId;
                const boxStyle: React.CSSProperties = {
                  left: `${l.x * 100}%`, top: `${l.y * 100}%`,
                  width: `${l.w * 100}%`, height: `${l.h * 100}%`,
                  opacity: l.kind === 'mask' ? 1 : l.opacity,
                  mixBlendMode: l.kind !== 'mask' && l.blendMode !== 'normal' ? l.blendMode : undefined,
                  transform: l.rotation ? `rotate(${l.rotation}deg)` : undefined,
                };
                return (
                  <div
                    key={l.id}
                    className={[
                      styles.editorLayerBox,
                      isSel ? styles.editorLayerSelected : '',
                      l.kind === 'mask' ? (l.maskMode === 'exclude' ? styles.maskExclude : styles.maskInclude) : '',
                    ].join(' ')}
                    style={boxStyle}
                  >
                    {l.kind === 'shape' && l.shape !== 'line' && l.shape !== 'arrow' && (
                      <div style={{ position: 'absolute', inset: 0, background: l.fill, border: `2px solid ${l.stroke ?? 'transparent'}`, borderRadius: l.shape === 'ellipse' ? '50%' : 2 }} />
                    )}
                    {l.kind === 'shape' && (l.shape === 'line' || l.shape === 'arrow') && (
                      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} viewBox="0 0 100 100" preserveAspectRatio="none">
                        <line x1="0" y1="0" x2="100" y2="100" stroke={l.stroke ?? '#fff'} strokeWidth={l.strokeWidth ?? 3} vectorEffect="non-scaling-stroke" />
                      </svg>
                    )}
                    {l.kind === 'text' && (
                      <div
                        style={{ position: 'absolute', inset: 0, color: l.color, fontWeight: 700, fontFamily: l.fontFamily, fontSize: `${(l.fontSize ?? 0.06) * 520}px`, lineHeight: 1.2, whiteSpace: 'pre-wrap', overflow: 'hidden' }}
                        onDoubleClick={() => {
                          const next = window.prompt('Text:', l.text ?? '');
                          if (next !== null && node && variant) updateLayer(node.id, variant.id, l.id, { text: next });
                        }}
                      >
                        {l.text}
                      </div>
                    )}
                    {l.kind === 'image' && l.image && (
                      <img src={l.image} alt={l.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} draggable={false} />
                    )}
                    {l.kind === 'adjustment' && (
                      <div style={{ position: 'absolute', inset: 0, backdropFilter: l.filter }} />
                    )}
                    {l.kind === 'mask' && (
                      <span className={styles.maskTag}>{l.maskMode === 'exclude' ? '🚫 protected' : `✏ ${l.prompt?.slice(0, 30) || 'edit region'}`}</span>
                    )}
                    {isSel && (
                      <span
                        className={styles.resizeHandleDot}
                        onPointerDown={(e) => startResize(e, l)}
                        title="Drag to resize"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className={styles.editorHint}>
              Draw with the shape/mask tools · drag layers to move · corner dot resizes ·
              double-click text to edit · include-masks + instructions feed banana2 edits downstream.
            </div>
          </div>

          {/* Right: full layers panel */}
          <div className={styles.editorSide}>
            <LayersPanelBody
              node={node}
              variant={variant}
              selectedLayerId={selectedLayerId}
              onSelectLayer={setSelectedLayerId}
            />
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file || !node || !variant) return;
          const reader = new FileReader();
          reader.onload = () => {
            const layer = addLayer(node.id, variant.id, 'image', {
              image: reader.result as string,
              name: file.name,
              x: 0.25, y: 0.25, w: 0.5, h: 0.5,
            });
            setSelectedLayerId(layer.id);
            setTool({ id: 'select' });
          };
          reader.readAsDataURL(file);
          e.target.value = '';
        }}
      />
    </div>
  );
};
