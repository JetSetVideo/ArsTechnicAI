// ============================================================
// ARS TECHNICAI — Scene Lighting Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = '3d.lighting';

export const moduleDef: ModuleDef = {
  id,
  name: 'Scene Lighting',
  category: 'spatial',
  description: 'Scene Lighting — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
