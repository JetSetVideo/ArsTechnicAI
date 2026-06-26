// ============================================================
// ARS TECHNICAI — Layer Compositor Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'asm.layer.composite';

export const moduleDef: ModuleDef = {
  id,
  name: 'Layer Compositor',
  category: 'assembly',
  description: 'Layer Compositor — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
