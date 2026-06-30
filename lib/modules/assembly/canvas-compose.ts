// ============================================================
// ARS TECHNICAI — Canvas Compose Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'assembly.canvas-compose';

export const moduleDef: ModuleDef = {
  id,
  name: 'Canvas Compose',
  category: 'assembly',
  description: 'Compose multiple canvas items into a single output image or video frame with precise layout control.',
  inputs: [
    { id: 'input', label: 'Input Data', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'format', label: 'Output Format', type: 'enum', default: 'png', options: ['png', 'jpg', 'webp'] },
    { id: 'width', label: 'Width', type: 'number', default: 1920, min: 64, max: 8192 },
    { id: 'height', label: 'Height', type: 'number', default: 1080, min: 64, max: 8192 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    ctx.onProgress?.(50, 'Processing...');
    return {
      outputs: { result: ctx.parameters },
      metadata: { operation: 'canvas-compose', timestamp: Date.now() },
    };
  },
};
