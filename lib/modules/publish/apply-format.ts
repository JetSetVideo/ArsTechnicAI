// ============================================================
// ARS TECHNICAI — Apply Format Profile Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'pub.apply.format';

export const moduleDef: ModuleDef = {
  id,
  name: 'Apply Format Profile',
  category: 'publish',
  description: 'Apply Format Profile — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
