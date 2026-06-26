// ============================================================
// ARS TECHNICAI — Style Transfer Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.style.transfer';

export const moduleDef: ModuleDef = {
  id,
  name: 'Style Transfer',
  category: 'generate',
  description: 'Style Transfer — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
