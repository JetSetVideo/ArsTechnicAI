// ============================================================
// ARS TECHNICAI — Audio Trim Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.audio.trim';

export const moduleDef: ModuleDef = {
  id,
  name: 'Audio Trim',
  category: 'edit',
  description: 'Audio Trim — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
