// ============================================================
// ARS TECHNICAI — Overlay Image Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.overlay';

export const moduleDef: ModuleDef = {
  id,
  name: 'Overlay Image',
  category: 'edit',
  description: 'Overlay one image on top of another with position, scale, rotation, and blending controls. Perfect for watermarks, logos, and composites.',
  inputs: [
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input' },
  ],
  outputs: [
    { id: 'image', label: 'Processed Image', type: 'image', direction: 'output' },
  ],
  parameters: [
    { id: 'x', label: 'X Position', type: 'number', default: 0 },
    { id: 'y', label: 'Y Position', type: 'number', default: 0 },
    { id: 'scale', label: 'Scale', type: 'number', default: 1, min: 0.01, max: 10, step: 0.01 },
    { id: 'opacity', label: 'Opacity', type: 'number', default: 100, min: 0, max: 100 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return {
      outputs: { overlayParams: { x: ctx.parameters.x || 0, y: ctx.parameters.y || 0, scale: ctx.parameters.scale || 1, opacity: (ctx.parameters.opacity || 100) / 100 } },
      metadata: { operation: 'overlay' },
    };
  },
};
