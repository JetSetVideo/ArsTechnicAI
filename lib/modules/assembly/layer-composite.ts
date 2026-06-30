// ============================================================
// ARS TECHNICAI — Layer Composite Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'assembly.layer-composite';

export const moduleDef: ModuleDef = {
  id,
  name: 'Layer Composite',
  category: 'assembly',
  description: 'Composite multiple layers with blend modes, masks, and opacity into a final image or video frame.',
  inputs: [
    { id: 'input', label: 'Input Data', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'blendMode', label: 'Default Blend', type: 'enum', default: 'normal', options: ['normal', 'multiply', 'screen', 'overlay'] },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    ctx.onProgress?.(50, 'Processing...');
    return {
      outputs: { result: ctx.parameters },
      metadata: { operation: 'layer-composite', timestamp: Date.now() },
    };
  },
};
