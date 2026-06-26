// ============================================================
// ARS TECHNICAI — Schedule Publish Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'pub.schedule';

export const moduleDef: ModuleDef = {
  id,
  name: 'Schedule Publish',
  category: 'publish',
  description: 'Schedule Publish — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
