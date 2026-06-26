// ============================================================
// ARS TECHNICAI — Script to Shot List Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'intel.script.to.shots';

export const moduleDef: ModuleDef = {
  id,
  name: 'Script to Shot List',
  category: 'intelligence',
  description: 'Script to Shot List — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
