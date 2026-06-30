// ============================================================
// ARS TECHNICAI — Upscale Image Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.upscale';

export const moduleDef: ModuleDef = {
  id,
  name: 'Upscale Image',
  category: 'generate',
  description: 'Increase resolution using AI super-resolution.',
  inputs: [
    { id: 'prompt', label: 'Prompt', type: 'text', direction: 'input', optional: true },
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
    { id: 'params', label: 'Params', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'scale', label: 'Scale', type: 'enum', default: '2x', options: ['2x', '4x', '8x'] },
    { id: 'enhanceFaces', label: 'Enhance Faces', type: 'boolean', default: true },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return { outputs: { upscaleParams: ctx.parameters }, metadata: { operation: 'upscale' } };
  },
};
