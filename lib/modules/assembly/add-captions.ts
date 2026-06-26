// ============================================================
// ARS TECHNICAI — Add Captions Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'asm.add.captions';

export const moduleDef: ModuleDef = {
  id,
  name: 'Add Captions',
  category: 'assembly',
  description: 'Add Captions — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
