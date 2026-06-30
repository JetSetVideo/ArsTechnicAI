// ============================================================
// ARS TECHNICAI — Generate Embedding Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.embedding';

export const moduleDef: ModuleDef = {
  id,
  name: 'Generate Embedding',
  category: 'generate',
  description: 'Generate vector embeddings for semantic search.',
  inputs: [
    { id: 'prompt', label: 'Prompt', type: 'text', direction: 'input', optional: true },
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
    { id: 'params', label: 'Params', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'type', label: 'Type', type: 'enum', default: 'text', options: ['text', 'image'] },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return { outputs: { embedParams: ctx.parameters }, metadata: { note: 'Embedding via AI API' } };
  },
};
