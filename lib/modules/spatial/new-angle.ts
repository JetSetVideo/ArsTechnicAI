// ============================================================
// ARS TECHNICAI — New Camera Angle Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'spatial.new-angle';

export const moduleDef: ModuleDef = {
  id,
  name: 'New Camera Angle',
  category: 'spatial',
  description: 'Generate a new view of a 3D scene from a different angle without re-rendering everything.',
  inputs: [
    { id: 'input', label: 'Input Data', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'angle', label: 'Angle', type: 'number', default: 45, min: 0, max: 360 },
    { id: 'distance', label: 'Distance', type: 'number', default: 3, min: 0.5, max: 20 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    ctx.onProgress?.(50, 'Processing...');
    return {
      outputs: { result: ctx.parameters },
      metadata: { operation: 'new-angle', timestamp: Date.now() },
    };
  },
};
