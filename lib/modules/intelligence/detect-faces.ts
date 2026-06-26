// ============================================================
// ARS TECHNICAI — Face Detection Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'intel.detect.faces';

export const moduleDef: ModuleDef = {
  id,
  name: 'Face Detection',
  category: 'intelligence',
  description: 'Face Detection — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
