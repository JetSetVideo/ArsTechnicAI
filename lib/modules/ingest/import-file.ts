// ============================================================
// ARS TECHNICAI — Universal File Import Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.import.file';

export const moduleDef: ModuleDef = {
  id,
  name: 'Universal File Import',
  category: 'ingest',
  description: 'Universal File Import — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
