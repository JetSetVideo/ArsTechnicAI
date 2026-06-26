// ============================================================
// ARS TECHNICAI — Metadata Extractor Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.extract.metadata';

export const moduleDef: ModuleDef = {
  id,
  name: 'Metadata Extractor',
  category: 'ingest',
  description: 'Metadata Extractor — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
