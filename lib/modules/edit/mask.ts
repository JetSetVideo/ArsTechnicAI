// ============================================================
// ARS TECHNICAI — Apply Mask Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.mask';

export const moduleDef: ModuleDef = {
  id,
  name: 'Apply Mask',
  category: 'edit',
  description: 'Apply Mask — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
