// ============================================================
// ARS TECHNICAI — Apply Format Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'publish.apply-format';

export const moduleDef: ModuleDef = {
  id,
  name: 'Apply Format',
  category: 'publish',
  description: 'Apply social media format presets: crop, resize, add safe zones, optimize for platform requirements.',
  inputs: [
    { id: 'input', label: 'Input Data', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'platform', label: 'Platform', type: 'enum', default: 'instagram', options: ['tiktok', 'instagram', 'youtube', 'twitter', 'facebook', 'linkedin'] },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    ctx.onProgress?.(50, 'Processing...');
    return {
      outputs: { result: ctx.parameters },
      metadata: { operation: 'apply-format', timestamp: Date.now() },
    };
  },
};
