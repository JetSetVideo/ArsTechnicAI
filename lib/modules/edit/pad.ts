// ============================================================
// ARS TECHNICAI — Pad / Letterbox Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.pad';

export const moduleDef: ModuleDef = {
  id,
  name: 'Pad / Letterbox',
  category: 'edit',
  description: 'Pad / Letterbox — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
