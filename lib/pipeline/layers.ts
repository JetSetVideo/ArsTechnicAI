// ─────────────────────────────────────────────────────────────────────────────
// Layer utilities — defaults, compositing, and banana2 region directives.
// Client-safe.
// ─────────────────────────────────────────────────────────────────────────────

import type { AssetLayer, DrawStroke, LayerKind, NodeVariant, BlendMode } from '@/types/pipeline';

export const BLEND_MODES: BlendMode[] = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light',
  'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
];

export const FILTER_PRESETS: { id: string; label: string; filter: string }[] = [
  { id: 'blur', label: 'Gaussian blur', filter: 'blur(6px)' },
  { id: 'sharpen-ish', label: 'Crisp (contrast+)', filter: 'contrast(1.25) saturate(1.05)' },
  { id: 'bw', label: 'Black & white', filter: 'grayscale(1)' },
  { id: 'sepia', label: 'Sepia', filter: 'sepia(0.8)' },
  { id: 'warm', label: 'Warm', filter: 'sepia(0.25) saturate(1.3) hue-rotate(-8deg)' },
  { id: 'cool', label: 'Cool', filter: 'saturate(1.1) hue-rotate(12deg) brightness(1.02)' },
  { id: 'fade', label: 'Faded film', filter: 'contrast(0.85) brightness(1.1) saturate(0.8)' },
  { id: 'vivid', label: 'Vivid', filter: 'saturate(1.6) contrast(1.1)' },
  { id: 'night', label: 'Night', filter: 'brightness(0.7) saturate(0.7) hue-rotate(20deg)' },
  { id: 'invert', label: 'Invert', filter: 'invert(1)' },
];

let layerSeq = 0;

export function createLayer(kind: LayerKind, partial: Partial<AssetLayer> = {}): AssetLayer {
  const now = Date.now();
  layerSeq += 1;
  const base: AssetLayer = {
    id: `layer-${now.toString(36)}-${layerSeq}`,
    name: '',
    kind,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    x: 0.3, y: 0.3, w: 0.4, h: 0.3,
    createdAt: now,
    updatedAt: now,
  };
  switch (kind) {
    case 'shape':
      return { ...base, name: 'Shape', shape: 'rectangle', fill: '#00d4aa55', stroke: '#00d4aa', strokeWidth: 3, ...partial };
    case 'text':
      return { ...base, name: 'Text', text: 'Double-click to edit', fontSize: 0.06, fontFamily: 'Inter, sans-serif', color: '#ffffff', h: 0.1, ...partial };
    case 'image':
      return { ...base, name: 'Image', ...partial };
    case 'mask':
      return {
        ...base,
        name: partial.maskMode === 'exclude' ? 'Protect region' : 'Edit region',
        maskMode: 'include',
        prompt: '',
        ...partial,
      };
    case 'adjustment':
      return { ...base, name: 'Adjustment', x: 0, y: 0, w: 1, h: 1, filter: 'contrast(1.25) saturate(1.05)', ...partial };
    case 'draw':
      return { ...base, name: 'Drawing', x: 0, y: 0, w: 1, h: 1, strokes: [], color: '#ff4d6d', ...partial };
    case 'group':
      return { ...base, name: 'Group', x: 0, y: 0, w: 1, h: 1, collapsed: false, ...partial };
    default:
      return { ...base, ...partial };
  }
}

/** A layer is shown when it and every group above it are visible. */
export function layerShown(layer: AssetLayer, layers: AssetLayer[]): boolean {
  if (!layer.visible) return false;
  const byId = new Map(layers.map((item) => [item.id, item]));
  const seen = new Set<string>();
  let parentId = layer.parentId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent || !parent.visible) return false;
    parentId = parent.parentId;
  }
  return true;
}

/** Puts the chosen layers inside a new group, just above the highest member. */
export function applyGroup(layers: AssetLayer[], memberIds: string[], group: AssetLayer): AssetLayer[] {
  const ids = new Set(memberIds.filter((id) => {
    const layer = layers.find((item) => item.id === id);
    return Boolean(layer && layer.kind !== 'group' && layer.id !== group.id);
  }));
  if (ids.size < 2) return layers;
  const next = layers.map((layer) => (ids.has(layer.id) ? { ...layer, parentId: group.id } : layer));
  const last = Math.max(...next.map((layer, index) => (ids.has(layer.id) ? index : -1)));
  next.splice(last + 1, 0, group);
  return next;
}

export function applyUngroup(layers: AssetLayer[], groupId: string): AssetLayer[] {
  return layers
    .filter((layer) => layer.id !== groupId)
    .map((layer) => (layer.parentId === groupId ? { ...layer, parentId: undefined } : layer));
}

function drawBounds(layer: AssetLayer): AssetLayer {
  const points = (layer.strokes ?? []).flatMap((stroke) => stroke.points);
  if (points.length === 0) return layer;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    ...layer,
    x,
    y,
    w: Math.max(0.02, Math.max(...xs) - x),
    h: Math.max(0.02, Math.max(...ys) - y),
  };
}

/** Human-readable region for prompt building: "left 30–70%, top 30–60%". */
function regionText(l: AssetLayer): string {
  const pct = (v: number) => Math.round(v * 100);
  return `region spanning ${pct(l.x)}–${pct(l.x + l.w)}% horizontally and ${pct(l.y)}–${pct(l.y + l.h)}% vertically`;
}

/**
 * Builds banana2 edit directives from a variant's mask layers:
 * include masks say what to change where; exclude masks protect regions.
 */
export function layerDirectives(variant: NodeVariant | undefined): string {
  const layers = variant?.layers ?? [];
  if (layers.length === 0) return '';
  const groupName = new Map(layers.filter((layer) => layer.kind === 'group').map((layer) => [layer.id, layer.name || 'Group']));
  const parts: string[] = [];
  for (const layer of layers) {
    if (!layerShown(layer, layers) || layer.kind === 'group') continue;
    const where = layer.parentId && groupName.get(layer.parentId)
      ? `In the layer group "${groupName.get(layer.parentId)}", `
      : '';
    if (layer.kind === 'mask') {
      if (layer.maskMode === 'exclude') {
        parts.push(`${where}do NOT modify the ${regionText(layer)} — keep it pixel-identical.`);
      } else if (layer.prompt?.trim()) {
        parts.push(`${where}in the ${regionText(layer)}: ${layer.prompt.trim()}.`);
      }
    } else if (layer.kind === 'text' && layer.text?.trim()) {
      parts.push(`${where}a note written on the picture says "${layer.text.trim()}" (${regionText(layer)}). Follow that note when changing the picture.`);
    } else if (layer.kind === 'draw' && (layer.strokes?.length ?? 0) > 0) {
      parts.push(`${where}a drawing marks the ${regionText(drawBounds(layer))}. Treat the ink as showing what to change there.`);
    } else if (layer.kind === 'shape') {
      parts.push(`${where}a ${layer.shape ?? 'shape'} highlights the ${regionText(layer)}.`);
    }
  }
  return parts.join(' ');
}

/** True when visible ink, text, shapes, or collage sit on top of the picture. */
export function variantCarriesMarks(variant: NodeVariant | undefined): boolean {
  const layers = variant?.layers ?? [];
  return layers.some((layer) => layerShown(layer, layers) && layer.kind !== 'mask' && layer.kind !== 'group');
}

// ── Format / size transforms ─────────────────────────────────────────────────

export interface ImageTransformOptions {
  /** Target aspect like '16:9', '9:16', '1:1', '4:5', '2.39:1'; undefined keeps current. */
  aspect?: string;
  /** How the aspect change is applied. */
  fit?: 'cover' | 'contain';
  /** Pad color for 'contain' letterboxing. */
  padColor?: string;
  /** Target width in px (height derived); undefined keeps current. */
  width?: number;
  /** Output encoding. */
  format?: 'png' | 'jpeg' | 'webp';
  /** 0..1 for jpeg/webp. */
  quality?: number;
}

export function parseAspect(aspect: string): number | null {
  const m = /^([\d.]+):([\d.]+)$/.exec(aspect.trim());
  if (!m) return null;
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  if (!w || !h) return null;
  return w / h;
}

/**
 * Re-crops / resizes / re-encodes an image entirely client-side.
 * cover = center-crop to the new aspect; contain = letterbox with padColor.
 */
export async function transformImage(src: string, opts: ImageTransformOptions): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(src);
  const srcW = img.naturalWidth || 1;
  const srcH = img.naturalHeight || 1;
  const srcRatio = srcW / srcH;
  const targetRatio = opts.aspect ? parseAspect(opts.aspect) ?? srcRatio : srcRatio;

  const outW = Math.round(opts.width ?? (targetRatio >= srcRatio ? srcW : Math.round(srcH * targetRatio)));
  const outH = Math.round(outW / targetRatio);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';

  if ((opts.fit ?? 'cover') === 'contain') {
    ctx.fillStyle = opts.padColor ?? '#000000';
    ctx.fillRect(0, 0, outW, outH);
    const scale = Math.min(outW / srcW, outH / srcH);
    const dw = srcW * scale;
    const dh = srcH * scale;
    ctx.drawImage(img, (outW - dw) / 2, (outH - dh) / 2, dw, dh);
  } else {
    // cover: center-crop the source to the target ratio
    let cropW = srcW;
    let cropH = srcH;
    if (srcRatio > targetRatio) cropW = Math.round(srcH * targetRatio);
    else cropH = Math.round(srcW / targetRatio);
    const sx = Math.round((srcW - cropW) / 2);
    const sy = Math.round((srcH - cropH) / 2);
    ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, outW, outH);
  }

  const format = opts.format ?? 'png';
  const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const dataUrl = canvas.toDataURL(mime, opts.quality ?? 0.92);
  return { dataUrl, width: outW, height: outH };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Flattens a variant (base image + visible layers) into a single PNG dataURL.
 * Mask layers are directives, not pixels — they are skipped.
 */
export async function compositeVariant(variant: NodeVariant): Promise<string> {
  if (!variant.image) throw new Error('Variant has no image to composite');
  const baseImg = await loadImage(variant.image);
  const W = baseImg.naturalWidth || 1024;
  const H = baseImg.naturalHeight || 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(baseImg, 0, 0, W, H);

  const layers = variant.layers ?? [];
  for (const l of layers) {
    if (!layerShown(l, layers) || l.kind === 'mask' || l.kind === 'group') continue;
    const x = l.x * W, y = l.y * H, w = l.w * W, h = l.h * H;
    ctx.save();
    ctx.globalAlpha = l.opacity;
    ctx.globalCompositeOperation = (l.blendMode === 'normal' ? 'source-over' : l.blendMode) as GlobalCompositeOperation;
    if (l.rotation) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate((l.rotation * Math.PI) / 180);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    try {
      if (l.kind === 'adjustment') {
        // Apply the filter to the accumulated pixels in the layer's region
        const snap = document.createElement('canvas');
        snap.width = W; snap.height = H;
        snap.getContext('2d')!.drawImage(canvas, 0, 0);
        ctx.filter = l.filter ?? 'none';
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.drawImage(snap, 0, 0);
        ctx.filter = 'none';
      } else if (l.kind === 'shape') {
        const sw = (l.strokeWidth ?? 3) * (W / 1024);
        ctx.beginPath();
        if (l.shape === 'ellipse') {
          ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        } else if (l.shape === 'line' || l.shape === 'arrow') {
          ctx.moveTo(x, y);
          ctx.lineTo(x + w, y + h);
        } else {
          ctx.rect(x, y, w, h);
        }
        if (l.fill && l.shape !== 'line' && l.shape !== 'arrow') { ctx.fillStyle = l.fill; ctx.fill(); }
        if (l.stroke) { ctx.strokeStyle = l.stroke; ctx.lineWidth = sw; ctx.stroke(); }
        if (l.shape === 'arrow') {
          const ang = Math.atan2(h, w);
          const ah = 14 * (W / 1024) + sw * 2;
          ctx.beginPath();
          ctx.moveTo(x + w, y + h);
          ctx.lineTo(x + w - ah * Math.cos(ang - 0.45), y + h - ah * Math.sin(ang - 0.45));
          ctx.lineTo(x + w - ah * Math.cos(ang + 0.45), y + h - ah * Math.sin(ang + 0.45));
          ctx.closePath();
          ctx.fillStyle = l.stroke ?? '#fff';
          ctx.fill();
        }
      } else if (l.kind === 'text' && l.text) {
        const size = (l.fontSize ?? 0.06) * H;
        ctx.font = `700 ${size}px ${l.fontFamily ?? 'Inter, sans-serif'}`;
        ctx.fillStyle = l.color ?? '#fff';
        ctx.textBaseline = 'top';
        const lines = l.text.split('\n');
        lines.forEach((line, i) => ctx.fillText(line, x, y + i * size * 1.2, w));
      } else if (l.kind === 'image' && l.image) {
        const im = await loadImage(l.image);
        ctx.drawImage(im, x, y, w, h);
      } else if (l.kind === 'draw') {
        paintStrokes(ctx, l.strokes ?? [], W, H);
      }
    } finally {
      ctx.restore();
    }
  }
  return canvas.toDataURL('image/png');
}

function paintStrokes(ctx: CanvasRenderingContext2D, strokes: DrawStroke[], width: number, height: number) {
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = Math.max(1.5, stroke.size * width);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    stroke.points.forEach((point, index) => {
      const px = point.x * width;
      const py = point.y * height;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    if (stroke.points.length === 1) {
      const point = stroke.points[0];
      ctx.arc(point.x * width, point.y * height, Math.max(1, stroke.size * width) / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.stroke();
    }
  }
}

/**
 * The picture a downstream generator should see: the base image with visible
 * drawings, text, shapes, and collage baked in. Masks stay as words, not pixels.
 */
export async function pictureForGenerator(variant: NodeVariant | undefined): Promise<string | undefined> {
  if (!variant?.image) return undefined;
  if (!variantCarriesMarks(variant)) return variant.image;
  try {
    return await compositeVariant(variant);
  } catch {
    return variant.image;
  }
}
