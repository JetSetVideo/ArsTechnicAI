// ============================================================
// ARS TECHNICAI — Image Embedding Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.embedding';

export const moduleDef: ModuleDef = {
  id,
  name: 'Image Embedding',
  category: 'generate',
  description: 'Image Embedding — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
