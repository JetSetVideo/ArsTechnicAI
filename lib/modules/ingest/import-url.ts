// ============================================================
// ARS TECHNICAI — URL Fetcher Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.import.url';

export const moduleDef: ModuleDef = {
  id,
  name: 'URL Fetcher',
  category: 'ingest',
  description: 'URL Fetcher — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
