// ============================================================
// ARS TECHNICAI — Video Generation Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.video';

export const moduleDef: ModuleDef = {
  id,
  name: 'Video Generation',
  category: 'generate',
  description: 'Video Generation — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
