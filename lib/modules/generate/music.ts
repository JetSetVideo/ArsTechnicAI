// ============================================================
// ARS TECHNICAI — Music Generation Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.music';

export const moduleDef: ModuleDef = {
  id,
  name: 'Music Generation',
  category: 'generate',
  description: 'Music Generation — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
