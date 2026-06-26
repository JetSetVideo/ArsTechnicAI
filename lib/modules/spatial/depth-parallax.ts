// ============================================================
// ARS TECHNICAI — Depth Parallax Module
// Phase stub: implement in upcoming phases
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = '3d.depth.parallax';

export const moduleDef: ModuleDef = {
  id,
  name: 'Depth Parallax',
  category: 'spatial',
  description: 'Depth Parallax — module stub',
  inputs: [],
  outputs: [],
  parameters: [],
  execute: async (_ctx: ModuleContext): Promise<ModuleResult> => {
    throw new Error(`Module ${id} is not yet implemented`);
  },
};
