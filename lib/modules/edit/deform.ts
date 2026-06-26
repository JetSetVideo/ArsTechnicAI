// ============================================================
// ARS TECHNICAI — Warp / Deform Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.deform';

export const moduleDef: ModuleDef = {
  id,
  name: 'Warp / Deform',
  category: 'edit',
  description: 'Warp / Deform — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
