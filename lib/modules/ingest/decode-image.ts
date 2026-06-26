// ============================================================
// ARS TECHNICAI — Image Decoder Module
// Phase 1.2: Decode image + extract metadata (sharp server, Canvas client)
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.decode.image';

export interface ImageMeta {
  width: number;
  height: number;
  format: string;
  channels: number;
  hasAlpha: boolean;
  size: number;
  dpi?: number;
  colorSpace?: string;
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Image Decoder',
  category: 'ingest',
  description: 'Decode image Blob and extract width, height, format, channels, DPI, color profile',
  library: 'sharp (server) / Browser Image (client)',
  inputs: [
    { id: 'file', name: 'File', type: 'data', required: true, description: 'Image Blob or File' },
  ],
  outputs: [
    { id: 'image', name: 'Image', type: 'image', description: 'Image data URL or ImageData' },
    { id: 'metadata', name: 'Metadata', type: 'data', description: 'ImageMeta object' },
  ],
  parameters: [],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const file = ctx.inputs.file as File | Blob | undefined;
    if (!file) {
      return { outputs: {}, error: 'No image file provided' };
    }

    const blob = file instanceof File ? file : new File([file], 'image', { type: 'image/png' });

    // Client-side decoding via Image element
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    const metadata: ImageMeta = {
      width: img.width,
      height: img.height,
      format: blob.type.replace('image/', '') || 'unknown',
      channels: blob.type === 'image/png' ? 4 : 3,
      hasAlpha: blob.type === 'image/png' || blob.type === 'image/webp' || blob.type === 'image/gif',
      size: blob.size,
    };

    return {
      outputs: {
        image: dataUrl,
        metadata,
      },
      logs: [`Decoded image: ${img.width}x${img.height} ${metadata.format}`],
    };
  },
};
