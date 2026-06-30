// ============================================================
// ARS TECHNICAI — Frame Interpolation Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.video-interpolate';

export const moduleDef: ModuleDef = {
  id,
  name: 'Frame Interpolation',
  category: 'generate',
  description: 'Generate intermediate frames for smooth slow motion.',
  inputs: [
    { id: 'prompt', label: 'Prompt', type: 'text', direction: 'input', optional: true },
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
    { id: 'params', label: 'Params', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'targetFPS', label: 'Target FPS', type: 'number', default: 60, min: 24, max: 240 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return { outputs: { interpolateParams: ctx.parameters }, metadata: { note: 'Frame interpolation via AI API' } };
  },
};
