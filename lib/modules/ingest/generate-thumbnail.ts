// ============================================================
// ARS TECHNICAI — Thumbnail Generator Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.generate.thumbnail';

export const moduleDef: ModuleDef = {
  id,
  name: 'Thumbnail Generator',
  category: 'ingest',
  description: 'Thumbnail Generator — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
