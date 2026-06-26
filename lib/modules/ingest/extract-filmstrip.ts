// ============================================================
// ARS TECHNICAI — Video Filmstrip Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.extract.filmstrip';

export const moduleDef: ModuleDef = {
  id,
  name: 'Video Filmstrip',
  category: 'ingest',
  description: 'Video Filmstrip — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
