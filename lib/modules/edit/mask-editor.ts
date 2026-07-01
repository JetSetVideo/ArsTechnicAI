// ============================================================
// ARS TECHNICAI — Mask Editor Module (COMFY-014)
// Create and edit masks for inpainting/compositing.
// Brush, eraser, fill, shapes, feather/blur, invert.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.mask.editor';

export interface MaskEditorState {
  width: number;
  height: number;
  tool: 'brush' | 'eraser' | 'fill' | 'rectangle' | 'ellipse' | 'lasso' | 'magic-wand';
  brushSize: number;
  hardness: number;     // 0 = soft edge, 1 = hard edge
  featherRadius: number; // px
  invert: boolean;
  opacity: number;      // mask opacity 0-1
  maskDataUrl?: string; // base64 PNG of current mask
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Mask Editor',
  category: 'edit',
  description: 'Create and edit masks for inpainting and compositing. 7 tools: brush, eraser, fill, rectangle, ellipse, lasso, magic wand. Configurable brush size, hardness, feather radius, and invert. Outputs grayscale mask where white = modify, black = preserve.',
  inputs: [
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input' },
    { id: 'existingMask', label: 'Existing Mask', type: 'mask', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'mask', label: 'Generated Mask', type: 'mask', direction: 'output' },
    { id: 'composite', label: 'Masked Composite', type: 'image', direction: 'output', optional: true },
    { id: 'maskData', label: 'Mask Data URL', type: 'image', direction: 'output' },
  ],
  parameters: [
    { id: 'tool', label: 'Active Tool', type: 'enum', options: ['brush', 'eraser', 'fill', 'rectangle', 'ellipse', 'lasso', 'magic-wand'], default: 'brush' },
    { id: 'brushSize', label: 'Brush Size', type: 'number', default: 20, min: 1, max: 500, step: 1 },
    { id: 'hardness', label: 'Brush Hardness', type: 'number', default: 0.8, min: 0, max: 1, step: 0.05 },
    { id: 'featherRadius', label: 'Feather Radius (px)', type: 'number', default: 0, min: 0, max: 100, step: 1 },
    { id: 'invert', label: 'Invert Mask', type: 'boolean', default: false },
    { id: 'opacity', label: 'Mask Opacity', type: 'number', default: 100, min: 0, max: 100 },
    { id: 'fillThreshold', label: 'Fill Threshold', type: 'number', default: 32, min: 0, max: 255 },
    { id: 'width', label: 'Mask Width', type: 'number', default: 512, min: 64, max: 4096, step: 64 },
    { id: 'height', label: 'Mask Height', type: 'number', default: 512, min: 64, max: 4096, step: 64 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const params = ctx.parameters;
    const w = (params.width as number) || 512;
    const h = (params.height as number) || 512;
    const invert = params.invert === true;
    const feather = (params.featherRadius as number) || 0;

    // Generate an initial mask or use existing
    let maskSvg = '';
    const existingMask = ctx.inputs.existingMask as string;

    if (existingMask) {
      // Use existing mask as base
      maskSvg = generateMaskOverlaySVG(w, h, invert, feather, existingMask);
    } else {
      // Generate empty mask with tool guide overlay
      maskSvg = generateEmptyMaskSVG(w, h, invert, feather, params);
    }

    const maskDataUrl = `data:image/svg+xml;base64,${btoa(maskSvg)}`;

    const state: MaskEditorState = {
      width: w, height: h,
      tool: (params.tool as MaskEditorState['tool']) || 'brush',
      brushSize: (params.brushSize as number) || 20,
      hardness: (params.hardness as number) || 0.8,
      featherRadius: feather,
      invert,
      opacity: (params.opacity as number || 100) / 100,
      maskDataUrl,
    };

    return {
      outputs: { mask: state, maskData: maskDataUrl, composite: null },
      metadata: { tool: state.tool, brushSize: state.brushSize, featherRadius: feather, inverted: invert },
    };
  },
};

function generateEmptyMaskSVG(
  w: number, h: number, invert: boolean, feather: number,
  params: Record<string, unknown>,
): string {
  const bgColor = invert ? '#ffffff' : '#000000';
  const guideColor = invert ? '#000000' : '#ffffff';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="feather">
      <feGaussianBlur stdDeviation="${feather}"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="${bgColor}" filter="url(#feather)"/>
  <text x="${w/2}" y="${h/2}" text-anchor="middle" fill="${guideColor}" font-size="14" opacity="0.3" font-family="monospace">
    Mask Canvas ${w}×${h}
  </text>
  <text x="${w/2}" y="${h/2 + 20}" text-anchor="middle" fill="${guideColor}" font-size="10" opacity="0.15" font-family="monospace">
    Tool: ${params.tool || 'brush'} | Size: ${params.brushSize || 20}px
  </text>
  <rect x="2" y="2" width="${w-4}" height="${h-4}" fill="none" stroke="${guideColor}" stroke-width="1" opacity="0.1" stroke-dasharray="8,8"/>
</svg>`;
}

function generateMaskOverlaySVG(
  w: number, h: number, invert: boolean, feather: number,
  existingMaskUrl: string,
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="feather">
      <feGaussianBlur stdDeviation="${feather}"/>
    </filter>
  </defs>
  <image href="${existingMaskUrl}" width="100%" height="100%" filter="url(#feather)"/>
  ${invert ? '<rect width="100%" height="100%" fill="white" style="mix-blend-mode: difference"/>' : ''}
  <rect x="0" y="0" width="100%" height="100%" fill="none" stroke="rgba(0,212,170,0.3)" stroke-width="1"/>
</svg>`;
}
