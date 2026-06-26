// ============================================================
// ARS TECHNICAI — Model Animation Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = '3d.animate.model';

export const moduleDef: ModuleDef = {
  id,
  name: 'Model Animation',
  category: 'spatial',
  description: 'Model Animation — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
