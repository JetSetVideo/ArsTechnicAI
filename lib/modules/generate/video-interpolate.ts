// ============================================================
// ARS TECHNICAI — Frame Interpolation Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.video.interpolate';

export const moduleDef: ModuleDef = {
  id,
  name: 'Frame Interpolation',
  category: 'generate',
  description: 'Frame Interpolation — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
