// ============================================================
// ARS TECHNICAI — Comic Layout Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'assembly.comic-layout';

export const moduleDef: ModuleDef = {
  id,
  name: 'Comic Layout',
  category: 'assembly',
  description: 'Arrange images in comic/manga panel layouts with gutters, speech bubbles, and onomatopoeia effects.',
  inputs: [
    { id: 'input', label: 'Input Data', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'layout', label: 'Layout', type: 'enum', default: '3x2', options: ['2x2', '3x2', 'manga-page', '4-panel', '6-panel', 'splash'] },
    { id: 'gutters', label: 'Gutter Width (px)', type: 'number', default: 8, min: 0, max: 40 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    ctx.onProgress?.(50, 'Processing...');
    return {
      outputs: { result: ctx.parameters },
      metadata: { operation: 'comic-layout', timestamp: Date.now() },
    };
  },
};
