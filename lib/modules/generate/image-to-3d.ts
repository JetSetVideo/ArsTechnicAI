// ============================================================
// ARS TECHNICAI — Image to 3D Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.image-to-3d';

export const moduleDef: ModuleDef = {
  id,
  name: 'Image to 3D',
  category: 'generate',
  description: 'Convert 2D image to 3D model using AI depth estimation.',
  inputs: [
    { id: 'prompt', label: 'Prompt', type: 'text', direction: 'input', optional: true },
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
    { id: 'params', label: 'Params', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'quality', label: 'Quality', type: 'enum', default: 'standard', options: ['draft', 'standard', 'high'] },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return { outputs: { params: ctx.parameters }, metadata: { note: 'Requires 3D AI API' } };
  },
};
