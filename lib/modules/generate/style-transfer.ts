// ============================================================
// ARS TECHNICAI — Style Transfer Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.style-transfer';

export const moduleDef: ModuleDef = {
  id,
  name: 'Style Transfer',
  category: 'generate',
  description: 'Apply artistic style from presets or reference image.',
  inputs: [
    { id: 'prompt', label: 'Prompt', type: 'text', direction: 'input', optional: true },
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
    { id: 'params', label: 'Params', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'style', label: 'Style', type: 'enum', default: 'van-gogh', options: ['van-gogh', 'monet', 'ukiyo-e', 'cyberpunk', 'oil-painting', 'watercolor', 'anime', 'pixel-art'] },
    { id: 'strength', label: 'Strength', type: 'number', default: 0.7, min: 0, max: 1, step: 0.01 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return { outputs: { styleParams: ctx.parameters }, metadata: { operation: 'style-transfer' } };
  },
};
