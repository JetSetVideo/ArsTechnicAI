// ============================================================
// ARS TECHNICAI — Upscale Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.upscale';

export const moduleDef: ModuleDef = {
  id,
  name: 'Upscale',
  category: 'generate',
  description: 'Upscale — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
