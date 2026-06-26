// ============================================================
// ARS TECHNICAI — Resize Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.resize';

export const moduleDef: ModuleDef = {
  id,
  name: 'Resize',
  category: 'edit',
  description: 'Resize — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
