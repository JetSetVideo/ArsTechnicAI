// ============================================================
// ARS TECHNICAI — Remove Background Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.background-remove';

export const moduleDef: ModuleDef = {
  id,
  name: 'Remove Background',
  category: 'edit',
  description: 'Remove image background using AI segmentation. Supports automatic subject detection with edge refinement and transparency output.',
  inputs: [
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input' },
  ],
  outputs: [
    { id: 'image', label: 'Processed Image', type: 'image', direction: 'output' },
  ],
  parameters: [
    { id: 'threshold', label: 'Detection Threshold', type: 'number', default: 50, min: 0, max: 100 },
    { id: 'refineEdges', label: 'Refine Edges', type: 'boolean', default: True },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return {
      outputs: { bgRemovalParams: { threshold: ctx.parameters.threshold || 50, refineEdges: ctx.parameters.refineEdges !== False } },
      metadata: { operation: 'background-remove', note: 'Requires AI API key for full quality' },
    };
  },
};
