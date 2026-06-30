// ============================================================
// ARS TECHNICAI — Deform Image Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.deform';

export const moduleDef: ModuleDef = {
  id,
  name: 'Deform Image',
  category: 'edit',
  description: 'Apply geometric deformations: perspective, skew, warp, bulge, pinch, twirl, and ripple effects.',
  inputs: [
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input' },
  ],
  outputs: [
    { id: 'image', label: 'Processed Image', type: 'image', direction: 'output' },
  ],
  parameters: [
    { id: 'type', label: 'Deformation Type', type: 'enum', default: perspective, options: ['perspective', 'skew-x', 'skew-y', 'bulge', 'pinch', 'twirl', 'ripple', 'wave'] },
    { id: 'amount', label: 'Amount', type: 'number', default: 20, min: -100, max: 100 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return {
      outputs: { deformParams: { type: ctx.parameters.type || 'perspective', amount: ctx.parameters.amount || 20 } },
      metadata: { operation: 'deform' },
    };
  },
};
