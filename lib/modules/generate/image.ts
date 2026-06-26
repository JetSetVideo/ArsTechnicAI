// ============================================================
// ARS TECHNICAI — Image Generation Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.image';

export const moduleDef: ModuleDef = {
  id,
  name: 'Image Generation',
  category: 'generate',
  description: 'Image Generation — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
