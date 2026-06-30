import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';
export const id = 'gen.inpaint';
export const moduleDef: ModuleDef = {
  id, name: 'Inpaint', category: 'generate',
  description: 'Fill selected regions of an image using AI-powered inpainting.',
  inputs: [
    { id: 'prompt', label: 'Prompt', type: 'text', direction: 'input', optional: true },
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
    { id: 'params', label: 'Params', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'prompt', label: 'Fill Prompt', type: 'string', default: '' },
    { id: 'strength', label: 'Generation Strength', type: 'number', default: 0.75, min: 0, max: 1, step: 0.01 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return { outputs: { inpaintParams: ctx.parameters }, metadata: { operation: 'inpaint' } };
  },
};