// ============================================================
// ARS TECHNICAI — Splat Camera Move Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = '3d.splat.camera';

export const moduleDef: ModuleDef = {
  id,
  name: 'Splat Camera Move',
  category: 'spatial',
  description: 'Splat Camera Move — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
