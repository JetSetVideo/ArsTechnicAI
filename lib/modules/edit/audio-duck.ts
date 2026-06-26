// ============================================================
// ARS TECHNICAI — Audio Ducking Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.audio.duck';

export const moduleDef: ModuleDef = {
  id,
  name: 'Audio Ducking',
  category: 'edit',
  description: 'Audio Ducking — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
