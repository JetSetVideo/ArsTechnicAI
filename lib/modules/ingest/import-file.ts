// ============================================================
// ARS TECHNICAI — Universal File Import Module
// Phase 1.1: Detects file type and routes to appropriate decoder
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';
import type { Asset } from '@/types';

export const id = 'import.import.file';

function detectAssetType(file: File): Asset['type'] {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/csv') return 'text';

  // Extension fallbacks
  if (/\.(png|jpe?g|webp|gif|svg|bmp|tiff?|ico|exr|hdr)$/i.test(name)) return 'image';
  if (/\.(mp4|webm|mov|mkv|avi|m4v|ogv|flv)$/i.test(name)) return 'video';
  if (/\.(wav|mp3|aac|ogg|flac|m4a|wma)$/i.test(name)) return 'audio';
  if (/\.(glb|gltf|obj|fbx|ply|splat)$/i.test(name)) return 'model_3d';
  if (/\.(srt|vtt|txt|md|csv|json|yaml|yml|xml)$/i.test(name)) return 'text';

  return 'text';
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Universal File Import',
  category: 'ingest',
  description: 'Detects file type from Blob and produces a typed Asset with metadata',
  library: 'Browser File API',
  inputs: [
    { id: 'file', name: 'File', type: 'data', required: true, description: 'Blob or File to import' },
  ],
  outputs: [
    { id: 'asset', name: 'Asset', type: 'data', description: 'Typed Asset object' },
    { id: 'type', name: 'Detected Type', type: 'text', description: 'Detected asset type string' },
  ],
  parameters: [
    { id: 'generateThumbnail', name: 'Generate Thumbnail', type: 'boolean', default: true },
    { id: 'extractMetadata', name: 'Extract Metadata', type: 'boolean', default: true },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const file = ctx.inputs.file as File | Blob | undefined;
    if (!file) {
      return { outputs: {}, error: 'No file provided to import.import.file' };
    }

    const f = file instanceof File ? file : new File([file], 'unknown', { type: (file as Blob).type || 'application/octet-stream' });
    const assetType = detectAssetType(f);

    const asset: Asset = {
      id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: f.name,
      type: assetType,
      path: f.name,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      metadata: {
        mimeType: f.type || 'application/octet-stream',
        size: f.size,
      },
    };

    // For images, generate dataUrl and dimensions client-side
    if (assetType === 'image') {
      try {
        const dataUrl = await blobToDataUrl(f);
        asset.thumbnail = dataUrl;
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = dataUrl;
        });
        asset.metadata = {
          ...asset.metadata,
          width: img.width,
          height: img.height,
        };
      } catch {
        // Thumbnail generation failed, asset still valid
      }
    }

    // For video, extract basic info via video element
    if (assetType === 'video') {
      try {
        const dataUrl = await blobToDataUrl(f);
        const video = await new Promise<HTMLVideoElement>((resolve, reject) => {
          const v = document.createElement('video');
          v.preload = 'metadata';
          v.onloadedmetadata = () => resolve(v);
          v.onerror = reject;
          v.src = dataUrl;
        });
        asset.metadata = {
          ...asset.metadata,
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
        };
        asset.thumbnail = dataUrl; // Use video src as placeholder thumbnail
      } catch {
        // Metadata extraction failed
      }
    }

    // For audio, extract basic info via audio element
    if (assetType === 'audio') {
      try {
        const dataUrl = await blobToDataUrl(f);
        const audio = await new Promise<HTMLAudioElement>((resolve, reject) => {
          const a = new Audio();
          a.preload = 'metadata';
          a.onloadedmetadata = () => resolve(a);
          a.onerror = reject;
          a.src = dataUrl;
        });
        asset.metadata = {
          ...asset.metadata,
          duration: audio.duration,
        };
      } catch {
        // Metadata extraction failed
      }
    }

    return {
      outputs: {
        asset,
        type: assetType,
      },
      logs: [`Imported ${f.name} as ${assetType}`],
    };
  },
};
