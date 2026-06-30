// ============================================================
// ARS TECHNICAI — Text to 3D Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.text-to-3d';

export const moduleDef: ModuleDef = {
  id,
  name: 'Text to 3D',
  category: 'generate',
  description: 'Generate 3D models from text descriptions.',
  inputs: [
    { id: 'prompt', label: 'Prompt', type: 'text', direction: 'input', optional: true },
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
    { id: 'params', label: 'Params', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'style', label: 'Style', type: 'enum', default: 'realistic', options: ['realistic', 'stylized', 'low-poly', 'voxel', 'smooth'] },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return { outputs: { params: ctx.parameters }, metadata: { note: 'Requires 3D AI API' } };
  },
};
