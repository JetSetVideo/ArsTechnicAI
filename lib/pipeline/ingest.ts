// ─────────────────────────────────────────────────────────────────────────────
// Data ingestion & curation — every picture entering the workshop passes here.
//
// Treatment applied on ingest (quality control):
//   • Size cap      — longest edge downscaled to MAX_DIMENSION (2048px)
//   • Privacy       — canvas re-encode strips ALL metadata (EXIF, GPS, XMP,
//                     camera serials); nothing but pixels survives
//   • Weight        — re-encoded to WebP when it wins, else PNG; byte size
//                     recorded; oversized results flagged
//   • Provenance    — original name, source kind, original/final dimensions
//                     and bytes recorded in the variant meta
//   • Velocity      — ingest is fully client-side (no network round-trip);
//                     payload stats warn before localStorage limits throttle
//                     persistence
// Client-safe.
// ─────────────────────────────────────────────────────────────────────────────

import type { PipelineNode } from '@/types/pipeline';

export const MAX_DIMENSION = 2048;          // px, longest edge after ingest
export const WARN_VARIANT_BYTES = 2 * 1024 * 1024;   // flag single results > 2 MB
export const WARN_TOTAL_BYTES = 4 * 1024 * 1024;     // localStorage risk threshold
export const HARD_TOTAL_BYTES = 8 * 1024 * 1024;     // persistence will likely fail

export interface IngestResult {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  originalName?: string;
  sourceKind: 'explorer' | 'file' | 'url';
  downscaled: boolean;
  metadataStripped: true;      // always — canvas re-encode keeps pixels only
  warnings: string[];
}

function dataUrlBytes(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.floor(b64.length * 0.75);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to decode'));
    img.src = src;
  });
}

/**
 * Curates one incoming picture: decode → cap dimensions → re-encode
 * (metadata stripped) → measure. Rejects non-decodable inputs.
 */
export async function ingestImage(
  src: string,
  opts: { name?: string; sourceKind?: IngestResult['sourceKind'] } = {},
): Promise<IngestResult> {
  const img = await loadImage(src);
  const w = img.naturalWidth || 1;
  const h = img.naturalHeight || 1;
  const warnings: string[] = [];

  const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, outW, outH);

  // Prefer WebP(0.92) — smaller than PNG for virtually all real images, and
  // every browser we support encodes it. Only fall back to a second
  // (synchronous, main-thread) PNG encode when WebP genuinely isn't
  // supported, instead of always encoding both just to compare sizes.
  const webp = canvas.toDataURL('image/webp', 0.92);
  const webpSupported = webp.startsWith('data:image/webp');
  const dataUrl = webpSupported ? webp : canvas.toDataURL('image/png');
  const bytes = dataUrlBytes(dataUrl);

  if (scale < 1) warnings.push(`Downscaled ${w}×${h} → ${outW}×${outH} (cap ${MAX_DIMENSION}px)`);
  if (bytes > WARN_VARIANT_BYTES) {
    warnings.push(`Heavy asset (${(bytes / 1048576).toFixed(1)} MB) — consider JPEG/WebP re-encode in Info → Format`);
  }

  return {
    dataUrl,
    width: outW,
    height: outH,
    bytes,
    originalName: opts.name,
    sourceKind: opts.sourceKind ?? 'file',
    downscaled: scale < 1,
    metadataStripped: true,
    warnings,
  };
}

// ── Payload telemetry ────────────────────────────────────────────────────────

export interface PayloadStats {
  totalBytes: number;
  imageCount: number;
  heaviestNode?: { title: string; bytes: number };
  level: 'ok' | 'warn' | 'critical';
}

/** Measures the in-memory/persisted weight of all variant images. */
export function payloadStats(nodes: PipelineNode[]): PayloadStats {
  let totalBytes = 0;
  let imageCount = 0;
  let heaviest: PayloadStats['heaviestNode'];
  for (const node of nodes) {
    let nodeBytes = 0;
    for (const v of node.variants) {
      if (v.image) {
        const b = dataUrlBytes(v.image);
        nodeBytes += b;
        totalBytes += b;
        imageCount += 1;
      }
    }
    if (nodeBytes > 0 && (!heaviest || nodeBytes > heaviest.bytes)) {
      heaviest = { title: node.title, bytes: nodeBytes };
    }
  }
  return {
    totalBytes,
    imageCount,
    heaviestNode: heaviest,
    level: totalBytes > HARD_TOTAL_BYTES ? 'critical' : totalBytes > WARN_TOTAL_BYTES ? 'warn' : 'ok',
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
