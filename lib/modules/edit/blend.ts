// ============================================================
// ARS TECHNICAI — Blend Two Images Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.blend';

export const moduleDef: ModuleDef = {
  id,
  name: 'Blend Two Images',
  category: 'edit',
  description: 'Blend Two Images — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
