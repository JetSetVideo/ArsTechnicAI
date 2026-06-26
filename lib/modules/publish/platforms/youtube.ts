// ============================================================
// ARS TECHNICAI — Publish to Youtube
// Phase stub: implement in Phase 8
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'pub.youtube';

export const moduleDef: ModuleDef = {
  id,
  name: 'Publish to Youtube',
  category: 'publish',
  description: 'Publish media to Youtube — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
