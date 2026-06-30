// ============================================================
// ARS TECHNICAI — Blend Images Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.blend';

export const moduleDef: ModuleDef = {
  id,
  name: 'Blend Images',
  category: 'edit',
  description: 'Blend two images together using compositing modes: normal, multiply, screen, overlay, soft-light, hard-light, difference, and more.',
  inputs: [
    { id: 'imageA', label: 'Image A', type: 'image', direction: 'input' },
    { id: 'imageB', label: 'Image B', type: 'image', direction: 'input' },
  ],
  outputs: [
    { id: 'image', label: 'Processed Image', type: 'image', direction: 'output' },
  ],
  parameters: [
    { id: 'mode', label: 'Blend Mode', type: 'enum', default: overlay, options: ['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light', 'difference', 'exclusion', 'color-dodge', 'color-burn'] },
    { id: 'opacity', label: 'Opacity', type: 'number', default: 50, min: 0, max: 100 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return {
      outputs: { blendParams: { mode: ctx.parameters.mode || 'overlay', opacity: (ctx.parameters.opacity || 50) / 100 } },
      metadata: { operation: 'blend' },
    };
  },
};
