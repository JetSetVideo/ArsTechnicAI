// ============================================================
// ARS TECHNICAI — Build Timeline Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'asm.timeline.build';

export const moduleDef: ModuleDef = {
  id,
  name: 'Build Timeline',
  category: 'assembly',
  description: 'Build Timeline — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
