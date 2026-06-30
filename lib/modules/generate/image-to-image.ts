import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';
export const id = 'gen.image.to.image';
export const moduleDef: ModuleDef = {
  id, name: 'Image to Image', category: 'generate',
  description: 'Transform an input image using a text prompt while preserving structure.',
  inputs: [
    { id: 'prompt', label: 'Prompt', type: 'text', direction: 'input', optional: true },
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
    { id: 'params', label: 'Params', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'prompt', label: 'Transform Prompt', type: 'string', default: '' },
    { id: 'strength', label: 'Transformation Strength', type: 'number', default: 0.6, min: 0, max: 1, step: 0.01 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return { outputs: { img2imgParams: ctx.parameters }, metadata: { operation: 'image-to-image' } };
  },
};