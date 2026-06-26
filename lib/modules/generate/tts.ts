// ============================================================
// ARS TECHNICAI — Text-to-Speech Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.tts';

export const moduleDef: ModuleDef = {
  id,
  name: 'Text-to-Speech',
  category: 'generate',
  description: 'Text-to-Speech — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
