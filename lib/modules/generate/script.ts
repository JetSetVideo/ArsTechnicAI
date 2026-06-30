// ============================================================
// ARS TECHNICAI — Generate Script Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.script';

export const moduleDef: ModuleDef = {
  id,
  name: 'Generate Script',
  category: 'generate',
  description: 'Generate video scripts from creative prompts.',
  inputs: [
    { id: 'prompt', label: 'Prompt', type: 'text', direction: 'input', optional: true },
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
    { id: 'params', label: 'Params', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'format', label: 'Format', type: 'enum', default: 'voiceover', options: ['screenplay', 'talking-head', 'voiceover', 'commercial', 'tutorial', 'story'] },
    { id: 'duration', label: 'Target Duration (s)', type: 'number', default: 60, min: 10, max: 600 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return { outputs: { scriptParams: ctx.parameters }, metadata: { note: 'Script via AI API' } };
  },
};
