// ============================================================
// ARS TECHNICAI — Segment Image Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'intelligence.segment';

export const moduleDef: ModuleDef = {
  id,
  name: 'Segment Image',
  category: 'intelligence',
  description: 'Segment an image into semantic regions: person, sky, ground, vegetation, buildings, water, and more.',
  inputs: [
    { id: 'input', label: 'Input Data', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'mode', label: 'Segmentation Mode', type: 'enum', default: 'semantic', options: ['semantic', 'instance', 'panoptic'] },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    ctx.onProgress?.(50, 'Processing...');
    return {
      outputs: { result: ctx.parameters },
      metadata: { operation: 'segment', timestamp: Date.now() },
    };
  },
};
