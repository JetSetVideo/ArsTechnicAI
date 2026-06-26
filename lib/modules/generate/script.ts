// ============================================================
// ARS TECHNICAI — Script Generation Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.script';

export const moduleDef: ModuleDef = {
  id,
  name: 'Script Generation',
  category: 'generate',
  description: 'Script Generation — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
