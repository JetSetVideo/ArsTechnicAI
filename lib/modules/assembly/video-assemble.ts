// ============================================================
// ARS TECHNICAI — Assemble Video Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'asm.video.assemble';

export const moduleDef: ModuleDef = {
  id,
  name: 'Assemble Video',
  category: 'assembly',
  description: 'Assemble Video — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
