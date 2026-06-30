// ============================================================
// ARS TECHNICAI — Apply Mask Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.mask';

export const moduleDef: ModuleDef = {
  id,
  name: 'Apply Mask',
  category: 'edit',
  description: 'Apply an alpha mask to an image. Supports grayscale masks, shape masks (circle, rectangle, rounded-rect), and gradient masks.',
  inputs: [
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input' },
    { id: 'mask', label: 'Mask Image', type: 'mask', direction: 'input' , optional: true },
  ],
  outputs: [
    { id: 'image', label: 'Processed Image', type: 'image', direction: 'output' },
  ],
  parameters: [
    { id: 'maskType', label: 'Mask Type', type: 'enum', default: circle, options: ['image', 'circle', 'rectangle', 'rounded-rect', 'gradient-top', 'gradient-bottom', 'gradient-radial'] },
    { id: 'invert', label: 'Invert Mask', type: 'boolean', default: False },
    { id: 'feather', label: 'Feather', type: 'number', default: 0, min: 0, max: 100 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return {
      outputs: { maskParams: { type: ctx.parameters.maskType || 'circle', invert: ctx.parameters.invert || False, feather: ctx.parameters.feather || 0 } },
      metadata: { operation: 'mask' },
    };
  },
};
