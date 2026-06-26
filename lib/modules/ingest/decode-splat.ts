// ============================================================
// ARS TECHNICAI — Gaussian Splat Loader Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.decode.splat';

export const moduleDef: ModuleDef = {
  id,
  name: 'Gaussian Splat Loader',
  category: 'ingest',
  description: 'Gaussian Splat Loader — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
