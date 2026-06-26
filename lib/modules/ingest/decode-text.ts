// ============================================================
// ARS TECHNICAI — Text/Data Parser Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.decode.text';

export const moduleDef: ModuleDef = {
  id,
  name: 'Text/Data Parser',
  category: 'ingest',
  description: 'Text/Data Parser — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
