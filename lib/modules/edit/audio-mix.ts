// ============================================================
// ARS TECHNICAI — Audio Mix Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.audio.mix';

export const moduleDef: ModuleDef = {
  id,
  name: 'Audio Mix',
  category: 'edit',
  description: 'Audio Mix — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
