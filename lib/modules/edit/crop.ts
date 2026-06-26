// ============================================================
// ARS TECHNICAI — Crop Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.crop';

export const moduleDef: ModuleDef = {
  id,
  name: 'Crop',
  category: 'edit',
  description: 'Crop — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
