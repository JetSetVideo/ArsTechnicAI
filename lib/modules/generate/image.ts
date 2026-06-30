import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';
export const id = 'gen.image';
export const moduleDef: ModuleDef = {
  id, name: 'Generate Image', category: 'generate',
  description: 'Generate images from text prompts using AI with configurable dimensions and style.',
  inputs: [
    { id: 'prompt', label: 'Prompt', type: 'text', direction: 'input', optional: true },
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
    { id: 'params', label: 'Params', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'prompt', label: 'Prompt', type: 'string', default: '' },
    { id: 'width', label: 'Width', type: 'number', default: 1024, min: 256, max: 2048, step: 64 },
    { id: 'height', label: 'Height', type: 'number', default: 1024, min: 256, max: 2048, step: 64 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    ctx.onProgress?.(50, 'Requesting generation...');
    return { outputs: { generationParams: ctx.parameters }, metadata: { note: 'Call /api/generate' } };
  },
};