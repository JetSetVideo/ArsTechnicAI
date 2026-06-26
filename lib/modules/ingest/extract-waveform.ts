// ============================================================
// ARS TECHNICAI — Audio Waveform Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.extract.waveform';

export const moduleDef: ModuleDef = {
  id,
  name: 'Audio Waveform',
  category: 'ingest',
  description: 'Audio Waveform — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
