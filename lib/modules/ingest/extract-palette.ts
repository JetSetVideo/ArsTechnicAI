// ============================================================
// ARS TECHNICAI — Color Palette Extractor Module
// Phase 1.6: Extract dominant colors from image
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.extract.palette';

export const moduleDef: ModuleDef = {
  id,
  name: 'Color Palette Extractor',
  category: 'ingest',
  description: 'Extract dominant color palette from an image',
  library: 'Canvas2D / sharp',
  inputs: [
    { id: 'image', name: 'Image', type: 'image', required: true, description: 'Source image data URL or path' },
  ],
  outputs: [
    { id: 'palette', name: 'Palette', type: 'data', array: true, description: 'Array of hex color strings' },
  ],
  parameters: [
    { id: 'count', name: 'Color Count', type: 'number', default: 6 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const imageSrc = ctx.inputs.image as string | undefined;
    if (!imageSrc) {
      return { outputs: {}, error: 'No image provided for palette extraction' };
    }

    const count = (ctx.params.count as number) ?? 6;

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = imageSrc;
    });

    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) {
      return { outputs: {}, error: 'Canvas 2D context not available' };
    }

    ctx2d.drawImage(img, 0, 0, 50, 50);
    const imageData = ctx2d.getImageData(0, 0, 50, 50).data;

    const colorMap = new Map<string, number>();
    for (let i = 0; i < imageData.length; i += 4) {
      const r = Math.round(imageData[i] / 32) * 32;
      const g = Math.round(imageData[i + 1] / 32) * 32;
      const b = Math.round(imageData[i + 2] / 32) * 32;
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
    }

    const palette = [...colorMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([color]) => color);

    return {
      outputs: { palette },
      logs: [`Extracted ${palette.length} dominant colors`],
    };
  },
};
