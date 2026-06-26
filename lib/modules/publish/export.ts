// ============================================================
// ARS TECHNICAI — Export Package Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'pub.export';

export const moduleDef: ModuleDef = {
  id,
  name: 'Export Package',
  category: 'publish',
  description: 'Export Package — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
