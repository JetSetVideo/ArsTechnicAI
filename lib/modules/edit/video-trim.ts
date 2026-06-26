// ============================================================
// ARS TECHNICAI — Video Trim Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.video.trim';

export const moduleDef: ModuleDef = {
  id,
  name: 'Video Trim',
  category: 'edit',
  description: 'Video Trim — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
