// ============================================================
// ARS TECHNICAI — Apply Filter Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.filter';

export const moduleDef: ModuleDef = {
  id,
  name: 'Apply Filter',
  category: 'edit',
  description: 'Apply Filter — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
