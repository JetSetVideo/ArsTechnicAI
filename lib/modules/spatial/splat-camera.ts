// ============================================================
// ARS TECHNICAI — Splat Camera Path Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'spatial.splat-camera';

export const moduleDef: ModuleDef = {
  id,
  name: 'Splat Camera Path',
  category: 'spatial',
  description: 'Create flythrough camera paths through Gaussian Splat scenes with smooth interpolation and DOF.',
  inputs: [
    { id: 'input', label: 'Input Data', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'speed', label: 'Fly Speed', type: 'number', default: 1, min: 0.1, max: 5, step: 0.1 },
    { id: 'style', label: 'Path Style', type: 'enum', default: 'curved', options: ['linear', 'curved', 'orbital', 'free-fly'] },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    ctx.onProgress?.(50, 'Processing...');
    return {
      outputs: { result: ctx.parameters },
      metadata: { operation: 'splat-camera', timestamp: Date.now() },
    };
  },
};
