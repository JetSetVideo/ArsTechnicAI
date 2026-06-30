// ============================================================
// ARS TECHNICAI — Text to Speech Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.tts';

export const moduleDef: ModuleDef = {
  id,
  name: 'Text to Speech',
  category: 'generate',
  description: 'Convert text to natural speech with voice selection.',
  inputs: [
    { id: 'prompt', label: 'Prompt', type: 'text', direction: 'input', optional: true },
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
    { id: 'params', label: 'Params', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'voice', label: 'Voice', type: 'enum', default: 'narrator', options: ['male-deep', 'female-warm', 'narrator', 'child', 'elderly', 'robot'] },
    { id: 'speed', label: 'Speed', type: 'number', default: 1, min: 0.5, max: 2, step: 0.1 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return { outputs: { ttsParams: ctx.parameters }, metadata: { note: 'TTS via AI API' } };
  },
};
