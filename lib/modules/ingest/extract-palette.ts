// ============================================================
// ARS TECHNICAI — Color Palette Extractor Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.extract.palette';

export const moduleDef: ModuleDef = {
  id,
  name: 'Color Palette Extractor',
  category: 'ingest',
  description: 'Color Palette Extractor — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
