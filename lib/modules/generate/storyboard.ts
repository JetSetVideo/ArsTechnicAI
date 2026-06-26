// ============================================================
// ARS TECHNICAI — Storyboard from Script Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.storyboard';

export const moduleDef: ModuleDef = {
  id,
  name: 'Storyboard from Script',
  category: 'generate',
  description: 'Storyboard from Script — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
