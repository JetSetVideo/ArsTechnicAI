// ============================================================
// ARS TECHNICAI — Inpaint Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.inpaint';

export const moduleDef: ModuleDef = {
  id,
  name: 'Inpaint',
  category: 'generate',
  description: 'Inpaint — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
