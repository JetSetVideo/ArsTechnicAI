// ============================================================
// ARS TECHNICAI — Overlay / Composite Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.overlay';

export const moduleDef: ModuleDef = {
  id,
  name: 'Overlay / Composite',
  category: 'edit',
  description: 'Overlay / Composite — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
