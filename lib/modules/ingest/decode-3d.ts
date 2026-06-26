// ============================================================
// ARS TECHNICAI — 3D Model Loader Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.decode.3d';

export const moduleDef: ModuleDef = {
  id,
  name: '3D Model Loader',
  category: 'ingest',
  description: '3D Model Loader — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
