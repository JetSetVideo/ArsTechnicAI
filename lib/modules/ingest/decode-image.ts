// ============================================================
// ARS TECHNICAI — Image Decoder Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.decode.image';

export const moduleDef: ModuleDef = {
  id,
  name: 'Image Decoder',
  category: 'ingest',
  description: 'Image Decoder — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
