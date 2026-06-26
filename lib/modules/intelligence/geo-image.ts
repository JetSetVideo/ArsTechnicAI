// ============================================================
// ARS TECHNICAI — Image from Geolocation Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'intel.geo.image';

export const moduleDef: ModuleDef = {
  id,
  name: 'Image from Geolocation',
  category: 'intelligence',
  description: 'Image from Geolocation — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
