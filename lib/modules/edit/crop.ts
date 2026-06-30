// ============================================================
// ARS TECHNICAI — Crop Image Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.crop';

export const moduleDef: ModuleDef = {
  id,
  name: 'Crop Image',
  category: 'edit',
  description: 'Crop an image to specified dimensions and position. Supports anchor-based cropping (top-left, center, etc.) and aspect ratio locking.',
  inputs: [
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input' },
  ],
  outputs: [
    { id: 'image', label: 'Cropped Image', type: 'image', direction: 'output' },
  ],
  parameters: [
    { id: 'x', label: 'X Offset', type: 'number', default: 0, min: 0 },
    { id: 'y', label: 'Y Offset', type: 'number', default: 0, min: 0 },
    { id: 'width', label: 'Crop Width', type: 'number', default: 512, min: 1 },
    { id: 'height', label: 'Crop Height', type: 'number', default: 512, min: 1 },
    { id: 'anchor', label: 'Anchor', type: 'enum', default: center, options: ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'] },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const image = ctx.inputs.image as string; // data URL
    const params = ctx.parameters;
    const x = (params.x as number) || 0;
    const y = (params.y as number) || 0;
    const w = (params.width as number) || 512;
    const h = (params.height as number) || 512;
    
    // Return crop parameters for client-side processing
    return {
      outputs: { image, cropParams: { x, y, width: w, height: h } },
      metadata: { operation: 'crop', params: { x, y, width: w, height: h } },
    };
  },
};
