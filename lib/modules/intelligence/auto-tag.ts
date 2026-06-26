// ============================================================
// ARS TECHNICAI — Auto-Tag Asset Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'intel.auto.tag';

export const moduleDef: ModuleDef = {
  id,
  name: 'Auto-Tag Asset',
  category: 'intelligence',
  description: 'Auto-Tag Asset — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
