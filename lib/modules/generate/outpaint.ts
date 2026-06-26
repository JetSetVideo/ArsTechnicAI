// ============================================================
// ARS TECHNICAI — Outpaint Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.outpaint';

export const moduleDef: ModuleDef = {
  id,
  name: 'Outpaint',
  category: 'generate',
  description: 'Outpaint — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
