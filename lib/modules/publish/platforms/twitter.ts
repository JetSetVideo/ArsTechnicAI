// ============================================================
// ARS TECHNICAI — Publish to Twitter
// Phase stub: implement in Phase 8
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'pub.twitter';

export const moduleDef: ModuleDef = {
  id,
  name: 'Publish to Twitter',
  category: 'publish',
  description: 'Publish media to Twitter — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
