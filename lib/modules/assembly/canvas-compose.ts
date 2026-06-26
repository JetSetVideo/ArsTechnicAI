// ============================================================
// ARS TECHNICAI — Canvas to Image Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'asm.canvas.compose';

export const moduleDef: ModuleDef = {
  id,
  name: 'Canvas to Image',
  category: 'assembly',
  description: 'Canvas to Image — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
