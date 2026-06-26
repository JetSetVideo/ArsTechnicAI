// ============================================================
// ARS TECHNICAI — Background Replace Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.background.replace';

export const moduleDef: ModuleDef = {
  id,
  name: 'Background Replace',
  category: 'edit',
  description: 'Background Replace — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
