// ============================================================
// ARS TECHNICAI — Archive Extractor Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.extract.zip';

export const moduleDef: ModuleDef = {
  id,
  name: 'Archive Extractor',
  category: 'ingest',
  description: 'Archive Extractor — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
