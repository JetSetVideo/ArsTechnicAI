// ============================================================
// ARS TECHNICAI — Image-to-Image Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.image.to.image';

export const moduleDef: ModuleDef = {
  id,
  name: 'Image-to-Image',
  category: 'generate',
  description: 'Image-to-Image — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
