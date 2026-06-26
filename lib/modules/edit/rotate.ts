// ============================================================
// ARS TECHNICAI — Rotate Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.rotate';

export const moduleDef: ModuleDef = {
  id,
  name: 'Rotate',
  category: 'edit',
  description: 'Rotate — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
