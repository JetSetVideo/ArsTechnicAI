// ============================================================
// ARS TECHNICAI — Publish to Instagram
// Phase stub: implement in Phase 8
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'pub.instagram';

export const moduleDef: ModuleDef = {
  id,
  name: 'Publish to Instagram',
  category: 'publish',
  description: 'Publish media to Instagram — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
