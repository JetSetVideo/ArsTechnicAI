// ============================================================
// ARS TECHNICAI — Burn Subtitles Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.subtitle.burn';

export const moduleDef: ModuleDef = {
  id,
  name: 'Burn Subtitles',
  category: 'edit',
  description: 'Burn Subtitles — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
