// ============================================================
// ARS TECHNICAI — Publish to Tiktok
// Phase stub: implement in Phase 8
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'pub.tiktok';

export const moduleDef: ModuleDef = {
  id,
  name: 'Publish to Tiktok',
  category: 'publish',
  description: 'Publish media to Tiktok — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
