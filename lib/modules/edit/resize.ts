// ============================================================
// ARS TECHNICAI — Resize Image Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.resize';

export const moduleDef: ModuleDef = {
  id,
  name: 'Resize Image',
  category: 'edit',
  description: 'Resize an image to target dimensions with configurable fit mode (contain, cover, fill, scale-down) and resampling quality.',
  inputs: [
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input' },
  ],
  outputs: [
    { id: 'image', label: 'Resized Image', type: 'image', direction: 'output' },
  ],
  parameters: [
    { id: 'width', label: 'Target Width', type: 'number', default: 1024, min: 1, max: 8192 },
    { id: 'height', label: 'Target Height', type: 'number', default: 1024, min: 1, max: 8192 },
    { id: 'fit', label: 'Fit Mode', type: 'enum', default: cover, options: ['contain', 'cover', 'fill', 'scale-down'] },
    { id: 'quality', label: 'Quality', type: 'enum', default: high, options: ['low', 'medium', 'high', 'lossless'] },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const params = ctx.parameters;
    return {
      outputs: { resizeParams: { width: params.width || 1024, height: params.height || 1024, fit: params.fit || 'cover' } },
      metadata: { operation: 'resize' },
    };
  },
};
