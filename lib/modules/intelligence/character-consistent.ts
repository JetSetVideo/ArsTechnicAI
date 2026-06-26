// ============================================================
// ARS TECHNICAI — Character Consistency Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'intel.character.consistent';

export const moduleDef: ModuleDef = {
  id,
  name: 'Character Consistency',
  category: 'intelligence',
  description: 'Character Consistency — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
