// ============================================================
// ARS TECHNICAI — Outpaint Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.outpaint';

export const moduleDef: ModuleDef = {
  id,
  name: 'Outpaint',
  category: 'generate',
  description: 'Extend image beyond original boundaries with AI fill.',
  inputs: [
    { id: 'prompt', label: 'Prompt', type: 'text', direction: 'input', optional: true },
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
    { id: 'params', label: 'Params', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'direction', label: 'Direction', type: 'enum', default: 'all', options: ['all', 'left', 'right', 'up', 'down'] },
    { id: 'expandBy', label: 'Expand (px)', type: 'number', default: 256, min: 64, max: 1024, step: 64 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return { outputs: { outpaintParams: ctx.parameters }, metadata: { operation: 'outpaint' } };
  },
};
