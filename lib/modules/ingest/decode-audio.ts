// ============================================================
// ARS TECHNICAI — Audio Decoder Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.decode.audio';

export const moduleDef: ModuleDef = {
  id,
  name: 'Audio Decoder',
  category: 'ingest',
  description: 'Audio Decoder — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
