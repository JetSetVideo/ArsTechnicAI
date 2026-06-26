// ============================================================
// ARS TECHNICAI — Video Decoder Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.decode.video';

export const moduleDef: ModuleDef = {
  id,
  name: 'Video Decoder',
  category: 'ingest',
  description: 'Video Decoder — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
