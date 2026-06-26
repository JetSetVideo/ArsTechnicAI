// ============================================================
// ARS TECHNICAI — Video Overlay Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.video.overlay';

export const moduleDef: ModuleDef = {
  id,
  name: 'Video Overlay',
  category: 'edit',
  description: 'Video Overlay — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
