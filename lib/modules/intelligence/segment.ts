// ============================================================
// ARS TECHNICAI — Image Segmentation Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'intel.segment';

export const moduleDef: ModuleDef = {
  id,
  name: 'Image Segmentation',
  category: 'intelligence',
  description: 'Image Segmentation — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
