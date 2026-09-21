import React, { useEffect, useState } from 'react';
import {
  Eye, EyeOff, Lock, Unlock, Trash2, Copy, ChevronUp, ChevronDown,
  Square, Circle, Type as TypeIcon, Image as ImageIcon, Scan, Ban,
  SlidersHorizontal, MoveUpRight, Layers as LayersIcon, Download,
  Crop, Loader2, Film,
} from 'lucide-react';
import type { AssetLayer, LayerKind, NodeVariant, PipelineNode, ShapeKind } from '@/types/pipeline';
import { BLEND_MODES, FILTER_PRESETS } from '@/lib/pipeline/layers';
import { ASPECT_RATIOS } from '@/lib/pipeline/catalog';
import { usePipelineStore } from '@/stores/pipelineStore';
import styles from './WorkshopFlow.module.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function activeVariantOf(node: PipelineNode): NodeVariant | undefined {
  return node.variants.find((v) => v.id === node.activeVariantId) ?? node.variants[0];
}

export function layerKindIcon(layer: AssetLayer, size = 12): React.ReactNode {
  switch (layer.kind) {
    case 'shape':
      return layer.shape === 'ellipse' ? <Circle size={size} />
        : layer.shape === 'arrow' || layer.shape === 'line' ? <MoveUpRight size={size} />
        : <Square size={size} />;
    case 'text': return <TypeIcon size={size} />;
    case 'image': return <ImageIcon size={size} />;
    case 'mask': return layer.maskMode === 'exclude' ? <Ban size={size} /> : <Scan size={size} />;
    case 'adjustment': return <SlidersHorizontal size={size} />;
    default: return <LayersIcon size={size} />;
  }
}

// ── Display overlay: renders layers over an image (non-interactive) ─────────

export const LayerOverlay: React.FC<{ variant: NodeVariant; showMasks?: boolean }> = ({ variant, showMasks = true }) => {
  if (!variant.layers?.length) return null;
  return (
    <div className={styles.layerOverlay} aria-hidden>
      {variant.layers.map((l) => {
        if (!l.visible) return null;
        const box: React.CSSProperties = {
          left: `${l.x * 100}%`,
          top: `${l.y * 100}%`,
          width: `${l.w * 100}%`,
          height: `${l.h * 100}%`,
          opacity: l.opacity,
          mixBlendMode: l.blendMode === 'normal' ? undefined : l.blendMode,
          transform: l.rotation ? `rotate(${l.rotation}deg)` : undefined,
        };
        if (l.kind === 'mask') {
          if (!showMasks) return null;
          return (
            <div
              key={l.id}
              className={`${styles.maskRegion} ${l.maskMode === 'exclude' ? styles.maskExclude : styles.maskInclude}`}
              style={{ ...box, opacity: 1 }}
            />
          );
        }
        if (l.kind === 'adjustment') {
          return <div key={l.id} style={{ ...box, position: 'absolute', backdropFilter: l.filter, pointerEvents: 'none' }} />;
        }
        if (l.kind === 'shape') {
          const common: React.CSSProperties = {
            ...box,
            position: 'absolute',
            background: l.shape === 'line' || l.shape === 'arrow' ? 'transparent' : l.fill,
            border: l.stroke && l.shape !== 'line' && l.shape !== 'arrow' ? `${Math.max(1, (l.strokeWidth ?? 3) / 3)}px solid ${l.stroke}` : undefined,
            borderRadius: l.shape === 'ellipse' ? '50%' : 2,
            pointerEvents: 'none',
          };
          if (l.shape === 'line' || l.shape === 'arrow') {
            return (
              <svg key={l.id} style={{ ...box, position: 'absolute', overflow: 'visible', pointerEvents: 'none' }} viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="0" y1="0" x2="100" y2="100" stroke={l.stroke ?? '#fff'} strokeWidth={l.strokeWidth ?? 3} vectorEffect="non-scaling-stroke" markerEnd={l.shape === 'arrow' ? 'url(#arrowhead)' : undefined} />
                {l.shape === 'arrow' && (
                  <defs>
                    <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                      <path d="M0,0 L8,4 L0,8 Z" fill={l.stroke ?? '#fff'} />
                    </marker>
                  </defs>
                )}
              </svg>
            );
          }
          return <div key={l.id} style={common} />;
        }
        if (l.kind === 'text') {
          return (
            <div key={l.id} style={{ ...box, position: 'absolute', color: l.color, fontFamily: l.fontFamily, fontWeight: 700, fontSize: `${(l.fontSize ?? 0.06) * 100 * 2.2}cqh`, lineHeight: 1.2, overflow: 'hidden', pointerEvents: 'none', whiteSpace: 'pre-wrap' }}>
              {l.text}
            </div>
          );
        }
        if (l.kind === 'image' && l.image) {
          return <img key={l.id} src={l.image} alt={l.name} style={{ ...box, position: 'absolute', objectFit: 'fill', pointerEvents: 'none' }} />;
        }
        return null;
      })}
    </div>
  );
};

// ── Layer list + per-layer detail editor ────────────────────────────────────

export const LayersPanelBody: React.FC<{
  node: PipelineNode;
  variant: NodeVariant;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  compact?: boolean;
}> = ({ node, variant, selectedLayerId, onSelectLayer, compact }) => {
  const { addLayer, updateLayer, removeLayer, duplicateLayer, reorderLayer, flattenVariant } = usePipelineStore();
  const layers = variant.layers ?? [];
  const selected = layers.find((l) => l.id === selectedLayerId) ?? null;
  const fileRef = React.useRef<HTMLInputElement>(null);

  const addBtn = (kind: LayerKind, label: string, icon: React.ReactNode, partial?: Partial<AssetLayer>) => (
    <button
      key={label}
      className={styles.layerAddBtn}
      title={`Add ${label} layer`}
      onClick={() => {
        if (kind === 'image') { fileRef.current?.click(); return; }
        const layer = addLayer(node.id, variant.id, kind, partial);
        onSelectLayer(layer.id);
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className={styles.layersBody}>
      {/* Add-layer bar */}
      <div className={styles.layerAddBar}>
        {addBtn('shape', 'Shape', <Square size={12} />)}
        {addBtn('text', 'Text', <TypeIcon size={12} />)}
        {addBtn('image', 'Image', <ImageIcon size={12} />)}
        {addBtn('mask', 'Include', <Scan size={12} />, { maskMode: 'include' })}
        {addBtn('mask', 'Exclude', <Ban size={12} />, { maskMode: 'exclude' })}
        {addBtn('adjustment', 'Filter', <SlidersHorizontal size={12} />)}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              const layer = addLayer(node.id, variant.id, 'image', { image: reader.result as string, name: file.name });
              onSelectLayer(layer.id);
            };
            reader.readAsDataURL(file);
            e.target.value = '';
          }}
        />
      </div>

      {/* Layer rows — topmost layer first (Photoshop order) */}
      <div className={styles.layerList}>
        {layers.length === 0 && (
          <div className={styles.layerEmptyHint}>
            No layers yet. Add shapes, text, collage images, include/exclude masks
            or filters — all non-destructive over the generated picture.
          </div>
        )}
        {[...layers].reverse().map((l) => (
          <div
            key={l.id}
            className={`${styles.layerRow} ${l.id === selectedLayerId ? styles.layerRowActive : ''}`}
            onClick={() => onSelectLayer(l.id === selectedLayerId ? null : l.id)}
          >
            <span className={styles.layerKindIcon} data-mask={l.kind === 'mask' ? l.maskMode : undefined}>
              {layerKindIcon(l)}
            </span>
            <input
              className={styles.layerName}
              value={l.name}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => updateLayer(node.id, variant.id, l.id, { name: e.target.value })}
            />
            {l.kind === 'mask' && (
              <span className={`${styles.maskBadge} ${l.maskMode === 'exclude' ? styles.maskBadgeExclude : ''}`}>
                {l.maskMode === 'exclude' ? 'protect' : 'edit'}
              </span>
            )}
            <button className={styles.layerIconBtn} title={l.visible ? 'Hide' : 'Show'}
              onClick={(e) => { e.stopPropagation(); updateLayer(node.id, variant.id, l.id, { visible: !l.visible }); }}>
              {l.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
            <button className={styles.layerIconBtn} title={l.locked ? 'Unlock' : 'Lock'}
              onClick={(e) => { e.stopPropagation(); updateLayer(node.id, variant.id, l.id, { locked: !l.locked }); }}>
              {l.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
            {!compact && (
              <>
                <button className={styles.layerIconBtn} title="Move up"
                  onClick={(e) => { e.stopPropagation(); reorderLayer(node.id, variant.id, l.id, 1); }}>
                  <ChevronUp size={12} />
                </button>
                <button className={styles.layerIconBtn} title="Move down"
                  onClick={(e) => { e.stopPropagation(); reorderLayer(node.id, variant.id, l.id, -1); }}>
                  <ChevronDown size={12} />
                </button>
                <button className={styles.layerIconBtn} title="Duplicate"
                  onClick={(e) => { e.stopPropagation(); duplicateLayer(node.id, variant.id, l.id); }}>
                  <Copy size={12} />
                </button>
              </>
            )}
            <button className={styles.layerIconBtn} title="Delete"
              onClick={(e) => { e.stopPropagation(); removeLayer(node.id, variant.id, l.id); if (selectedLayerId === l.id) onSelectLayer(null); }}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Selected layer detail */}
      {selected && !compact && (
        <div className={styles.layerDetail}>
          <div className={styles.sectionTitle}>Layer settings</div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Opacity</label>
            <div className={styles.sliderRow}>
              <input type="range" className={styles.slider} min={0} max={1} step={0.05}
                value={selected.opacity}
                onChange={(e) => updateLayer(node.id, variant.id, selected.id, { opacity: Number(e.target.value) })} />
              <span className={styles.sliderValue}>{Math.round(selected.opacity * 100)}%</span>
            </div>
          </div>
          {selected.kind !== 'mask' && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Blend mode</label>
              <select className={styles.selectInput} value={selected.blendMode}
                onChange={(e) => updateLayer(node.id, variant.id, selected.id, { blendMode: e.target.value as AssetLayer['blendMode'] })}>
                {BLEND_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
          {selected.kind === 'shape' && (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Form</label>
                <select className={styles.selectInput} value={selected.shape}
                  onChange={(e) => updateLayer(node.id, variant.id, selected.id, { shape: e.target.value as ShapeKind })}>
                  <option value="rectangle">Rectangle</option>
                  <option value="ellipse">Ellipse</option>
                  <option value="line">Line</option>
                  <option value="arrow">Arrow</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Fill</label>
                <div className={styles.colorRow}>
                  <input type="color" className={styles.colorInput} value={(selected.fill ?? '#00d4aa').slice(0, 7)}
                    onChange={(e) => updateLayer(node.id, variant.id, selected.id, { fill: e.target.value + '88' })} />
                  <span className={styles.sliderValue}>{selected.fill}</span>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Stroke</label>
                <div className={styles.colorRow}>
                  <input type="color" className={styles.colorInput} value={(selected.stroke ?? '#00d4aa').slice(0, 7)}
                    onChange={(e) => updateLayer(node.id, variant.id, selected.id, { stroke: e.target.value })} />
                  <input type="number" className={styles.input} style={{ width: 60 }} min={0} max={40}
                    value={selected.strokeWidth ?? 3}
                    onChange={(e) => updateLayer(node.id, variant.id, selected.id, { strokeWidth: Number(e.target.value) })} />
                </div>
              </div>
            </>
          )}
          {selected.kind === 'text' && (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Text</label>
                <textarea className={styles.textarea} value={selected.text ?? ''}
                  onChange={(e) => updateLayer(node.id, variant.id, selected.id, { text: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Color & size</label>
                <div className={styles.colorRow}>
                  <input type="color" className={styles.colorInput} value={selected.color ?? '#ffffff'}
                    onChange={(e) => updateLayer(node.id, variant.id, selected.id, { color: e.target.value })} />
                  <input type="range" className={styles.slider} min={0.02} max={0.2} step={0.005}
                    value={selected.fontSize ?? 0.06}
                    onChange={(e) => updateLayer(node.id, variant.id, selected.id, { fontSize: Number(e.target.value) })} />
                </div>
              </div>
            </>
          )}
          {selected.kind === 'mask' && (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Mask mode</label>
                <select className={styles.selectInput} value={selected.maskMode}
                  onChange={(e) => updateLayer(node.id, variant.id, selected.id, { maskMode: e.target.value as AssetLayer['maskMode'] })}>
                  <option value="include">Include — AI edits this region</option>
                  <option value="exclude">Exclude — AI must not touch it</option>
                </select>
              </div>
              {selected.maskMode === 'include' && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Region instruction (banana2)</label>
                  <textarea className={styles.textarea} placeholder="What should change inside this region…"
                    value={selected.prompt ?? ''}
                    onChange={(e) => updateLayer(node.id, variant.id, selected.id, { prompt: e.target.value })} />
                </div>
              )}
            </>
          )}
          {selected.kind === 'adjustment' && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Filter</label>
              <select className={styles.selectInput}
                value={FILTER_PRESETS.find((p) => p.filter === selected.filter)?.id ?? 'custom'}
                onChange={(e) => {
                  const preset = FILTER_PRESETS.find((p) => p.id === e.target.value);
                  if (preset) updateLayer(node.id, variant.id, selected.id, { filter: preset.filter, name: preset.label });
                }}>
                {FILTER_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                <option value="custom">Custom…</option>
              </select>
              <input className={styles.input} style={{ marginTop: 6 }} value={selected.filter ?? ''}
                onChange={(e) => updateLayer(node.id, variant.id, selected.id, { filter: e.target.value })} />
            </div>
          )}
        </div>
      )}

      {layers.length > 0 && variant.image && (
        <button
          className={styles.flattenBtn}
          title="Bake all visible layers into a new version"
          onClick={() => void flattenVariant(node.id, variant.id)}
        >
          <LayersIcon size={12} /> Flatten → new version
        </button>
      )}
    </div>
  );
};

// ── Variant info / metadata / format panel ───────────────────────────────────

const fmtDate = (t?: number) => (t ? new Date(t).toLocaleString() : '—');

/** Reads the pixel dimensions of a dataURL image. */
function useImageSize(src?: string): { w: number; h: number } | null {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!src) { setSize(null); return; }
    const img = new Image();
    img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  }, [src]);
  return size;
}

const WIDTH_PRESETS = [0, 512, 768, 1024, 1536, 2048];

export const VariantInfoBody: React.FC<{ node: PipelineNode; variant: NodeVariant }> = ({ node, variant }) => {
  const { updateVariant, transformVariant, duplicateVariant, setVariantText, addSceneFromNode } = usePipelineStore();
  const prompt = (variant.paramsSnapshot?.__prompt as string) ?? '';
  const model = (variant.meta?.model as string) ?? '—';
  const size = useImageSize(variant.image);

  // Format controls
  const [aspect, setAspect] = useState<string>('keep');
  const [fit, setFit] = useState<'cover' | 'contain'>('cover');
  const [width, setWidth] = useState<number>(0);
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [quality, setQuality] = useState<number>(0.92);
  const [busy, setBusy] = useState(false);

  const applyTransform = async () => {
    setBusy(true);
    try {
      await transformVariant(node.id, variant.id, {
        aspect: aspect === 'keep' ? undefined : aspect,
        fit,
        width: width || undefined,
        format,
        quality,
      });
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!variant.image) return;
    const a = document.createElement('a');
    a.href = variant.image;
    const ext = variant.image.startsWith('data:image/jpeg') ? 'jpg' : variant.image.startsWith('data:image/webp') ? 'webp' : 'png';
    a.download = `${node.title.replace(/\W+/g, '-')}-v${variant.version ?? 1}.${ext}`;
    a.click();
  };

  return (
    <div className={styles.infoBody}>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Label</label>
        <input className={styles.input} value={variant.label}
          onChange={(e) => updateVariant(node.id, variant.id, { label: e.target.value })} />
      </div>
      <div className={styles.metaGrid}>
        <span>Version</span><b>v{variant.version ?? 1}</b>
        <span>Created</span><b>{fmtDate(variant.createdAt)}</b>
        <span>Updated</span><b>{fmtDate(variant.updatedAt ?? variant.createdAt)}</b>
        {size && (<><span>Dimensions</span><b>{size.w} × {size.h}px</b></>)}
        <span>Seed</span><b>{variant.seed ?? '—'}</b>
        <span>Model</span><b>{model}</b>
        <span>Layers</span><b>{variant.layers?.length ?? 0}</b>
        <span>Pinned</span><b>{variant.pinned ? 'yes' : 'no'}</b>
        {variant.parentVariantId && (<><span>Derived from</span><b>{node.variants.find((v) => v.id === variant.parentVariantId)?.label ?? variant.parentVariantId.slice(0, 8)}</b></>)}
      </div>

      <div className={styles.infoActions}>
        <button className={styles.layerAddBtn} onClick={() => duplicateVariant(node.id, variant.id)} title="Duplicate this version as an editable draft">
          <Copy size={12} /> Duplicate as draft
        </button>
        {variant.image && (
          <>
            <button className={styles.layerAddBtn} onClick={download} title="Download this picture">
              <Download size={12} /> Download
            </button>
            <button
              className={styles.layerAddBtn}
              onClick={() => addSceneFromNode(node.id)}
              title="Append this picture to the film order (bottom strip)"
            >
              <Film size={12} /> Add to film
            </button>
          </>
        )}
      </div>

      {/* Format & size — client-side crop/resize/re-encode into a new version */}
      {variant.image && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}><Crop size={10} /> Format & size</div>
          <div className={styles.formatGrid}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Aspect</label>
              <select className={styles.selectInput} value={aspect} onChange={(e) => setAspect(e.target.value)}>
                <option value="keep">Keep current</option>
                {ASPECT_RATIOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Reframe</label>
              <select className={styles.selectInput} value={fit} onChange={(e) => setFit(e.target.value as 'cover' | 'contain')}>
                <option value="cover">Crop (cover)</option>
                <option value="contain">Letterbox (contain)</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Width</label>
              <select className={styles.selectInput} value={width} onChange={(e) => setWidth(Number(e.target.value))}>
                {WIDTH_PRESETS.map((w) => (
                  <option key={w} value={w}>{w === 0 ? 'Keep' : `${w}px`}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Encode</label>
              <select className={styles.selectInput} value={format} onChange={(e) => setFormat(e.target.value as 'png' | 'jpeg' | 'webp')}>
                <option value="png">PNG (lossless)</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WebP</option>
              </select>
            </div>
          </div>
          {format !== 'png' && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Quality</label>
              <div className={styles.sliderRow}>
                <input type="range" className={styles.slider} min={0.4} max={1} step={0.02}
                  value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
                <span className={styles.sliderValue}>{Math.round(quality * 100)}%</span>
              </div>
            </div>
          )}
          <button className={styles.flattenBtn} disabled={busy} onClick={() => void applyTransform()}>
            {busy ? <Loader2 size={12} className={styles.spin} /> : <Crop size={12} />}
            Apply → new version
          </button>
        </div>
      )}

      {prompt && (
        <div className={styles.field} style={{ marginTop: 10 }}>
          <label className={styles.fieldLabel}>Prompt used</label>
          <div className={styles.promptBox}>{prompt}</div>
        </div>
      )}

      {/* Editable text content — refine scripts, shot lists, briefs in place */}
      {variant.text !== undefined && variant.text !== null && (
        <div className={styles.field} style={{ marginTop: 8 }}>
          <label className={styles.fieldLabel}>Content (editable)</label>
          <textarea
            className={`${styles.textarea} ${styles.contentEditor}`}
            value={variant.text}
            onChange={(e) => setVariantText(node.id, variant.id, e.target.value)}
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
};
