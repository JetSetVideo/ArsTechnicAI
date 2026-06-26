// ============================================================
// ARS TECHNICAI — Load 3D Scene Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = '3d.load.scene';

export const moduleDef: ModuleDef = {
  id,
  name: 'Load 3D Scene',
  category: 'spatial',
  description: 'Load 3D Scene — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
