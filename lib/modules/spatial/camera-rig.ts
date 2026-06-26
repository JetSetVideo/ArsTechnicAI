// ============================================================
// ARS TECHNICAI — Camera Rig Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = '3d.camera.rig';

export const moduleDef: ModuleDef = {
  id,
  name: 'Camera Rig',
  category: 'spatial',
  description: 'Camera Rig — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
