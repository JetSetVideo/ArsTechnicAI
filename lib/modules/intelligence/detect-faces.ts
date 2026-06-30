// ============================================================
// ARS TECHNICAI — Detect Faces Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'intelligence.detect-faces';

export const moduleDef: ModuleDef = {
  id,
  name: 'Detect Faces',
  category: 'intelligence',
  description: 'Detect and analyze faces in images: count, positions, landmarks, expressions, age, gender estimation.',
  inputs: [
    { id: 'input', label: 'Input Data', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'minConfidence', label: 'Min Confidence', type: 'number', default: 0.7, min: 0, max: 1, step: 0.05 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    ctx.onProgress?.(50, 'Processing...');
    return {
      outputs: { result: ctx.parameters },
      metadata: { operation: 'detect-faces', timestamp: Date.now() },
    };
  },
};
