import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';
export const id = 'gen.sfx';
export const moduleDef: ModuleDef = {
  id, name: 'Generate SFX', category: 'generate',
  description: 'Generate sound effects from text descriptions.',
  inputs: [
    { id: 'prompt', label: 'Prompt', type: 'text', direction: 'input', optional: true },
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
    { id: 'params', label: 'Params', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'description', label: 'Sound Description', type: 'string', default: '' },
    { id: 'duration', label: 'Duration (s)', type: 'number', default: 3, min: 0.5, max: 30 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return { outputs: { sfxParams: ctx.parameters }, metadata: { note: 'SFX via AI API' } };
  },
};