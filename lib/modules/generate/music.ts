import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';
export const id = 'gen.music';
export const moduleDef: ModuleDef = {
  id, name: 'Generate Music', category: 'generate',
  description: 'Generate original music from text descriptions with genre, mood, and tempo control.',
  inputs: [
    { id: 'prompt', label: 'Prompt', type: 'text', direction: 'input', optional: true },
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
    { id: 'params', label: 'Params', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'genre', label: 'Genre', type: 'string', default: 'cinematic' },
    { id: 'mood', label: 'Mood', type: 'string', default: 'epic' },
    { id: 'duration', label: 'Duration (s)', type: 'number', default: 30, min: 10, max: 300 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return { outputs: { musicParams: ctx.parameters }, metadata: { note: 'Music via AI API' } };
  },
};