// ============================================================
// ARS TECHNICAI — Thumbnail Generator Module
// Phase 1.6: Generate thumbnail from image/video/asset
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.generate.thumbnail';

export const moduleDef: ModuleDef = {
  id,
  name: 'Thumbnail Generator',
  category: 'ingest',
  description: 'Generate a thumbnail from an image, video frame, or asset',
  library: 'sharp / Canvas2D',
  inputs: [
    { id: 'image', name: 'Image', type: 'image', required: true, description: 'Source image or video frame' },
  ],
  outputs: [
    { id: 'thumbnail', name: 'Thumbnail', type: 'image', description: 'Resized thumbnail image' },
  ],
  parameters: [
    { id: 'width', name: 'Width', type: 'number', default: 256 },
    { id: 'height', name: 'Height', type: 'number', default: 256 },
    { id: 'quality', name: 'JPEG Quality', type: 'number', default: 80 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const imageSrc = ctx.inputs.image as string | undefined;
    if (!imageSrc) {
      return { outputs: {}, error: 'No image provided for thumbnail generation' };
    }

    const width = (ctx.params.width as number) ?? 256;
    const height = (ctx.params.height as number) ?? 256;

    // Client-side thumbnail generation via canvas
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = imageSrc;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) {
      return { outputs: {}, error: 'Canvas 2D context not available' };
    }

    ctx2d.drawImage(img, 0, 0, width, height);
    const thumbnail = canvas.toDataURL('image/jpeg', ((ctx.params.quality as number) ?? 80) / 100);

    return {
      outputs: { thumbnail },
      logs: [`Generated ${width}x${height} thumbnail`],
    };
  },
};
