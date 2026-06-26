// ============================================================
// ARS TECHNICAI — Color Adjust Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.color.adjust';

export const moduleDef: ModuleDef = {
  id,
  name: 'Color Adjust',
  category: 'edit',
  description: 'Color Adjust — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
