// ============================================================
// ARS TECHNICAI — Video Transition Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.transition';

export const moduleDef: ModuleDef = {
  id,
  name: 'Video Transition',
  category: 'edit',
  description: 'Video Transition — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
