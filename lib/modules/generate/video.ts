import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';
export const id = 'gen.video';
export const moduleDef: ModuleDef = {
  id, name: 'Generate Video', category: 'generate',
  description: 'Generate video clips from text prompts or image sequences.',
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
    { id: 'duration', label: 'Duration (s)', type: 'number', default: 5, min: 1, max: 30 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return { outputs: { videoParams: ctx.parameters }, metadata: { note: 'Video via AI API' } };
  },
};