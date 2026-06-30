// ============================================================
// ARS TECHNICAI — Flip Image Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.flip';

export const moduleDef: ModuleDef = {
  id,
  name: 'Flip Image',
  category: 'edit',
  description: 'Flip an image horizontally, vertically, or both. Useful for mirror compositions and correcting orientations.',
  inputs: [
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input' },
  ],
  outputs: [
    { id: 'image', label: 'Processed Image', type: 'image', direction: 'output' },
  ],
  parameters: [
    { id: 'horizontal', label: 'Flip Horizontal', type: 'boolean', default: True },
    { id: 'vertical', label: 'Flip Vertical', type: 'boolean', default: False },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return {
      outputs: { flipParams: { horizontal: ctx.parameters.horizontal !== False, vertical: ctx.parameters.vertical || False } },
      metadata: { operation: 'flip' },
    };
  },
};
