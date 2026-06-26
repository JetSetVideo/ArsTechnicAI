// ============================================================
// ARS TECHNICAI — Text-to-3D Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.text.to.3d';

export const moduleDef: ModuleDef = {
  id,
  name: 'Text-to-3D',
  category: 'generate',
  description: 'Text-to-3D — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
