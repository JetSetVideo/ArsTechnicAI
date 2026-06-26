// ============================================================
// ARS TECHNICAI — Flip / Mirror Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.flip';

export const moduleDef: ModuleDef = {
  id,
  name: 'Flip / Mirror',
  category: 'edit',
  description: 'Flip / Mirror — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
