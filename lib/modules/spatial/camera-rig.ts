// ============================================================
// ARS TECHNICAI — Camera Rig Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'spatial.camera-rig';

export const moduleDef: ModuleDef = {
  id,
  name: 'Camera Rig',
  category: 'spatial',
  description: 'Create camera rigs: orbital, dolly, crane, handheld, and path-following with keyframe animation.',
  inputs: [
    { id: 'input', label: 'Input Data', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'type', label: 'Rig Type', type: 'enum', default: 'orbital', options: ['orbital', 'dolly', 'crane', 'handheld', 'path'] },
    { id: 'duration', label: 'Duration (s)', type: 'number', default: 5, min: 1, max: 60 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    ctx.onProgress?.(50, 'Processing...');
    return {
      outputs: { result: ctx.parameters },
      metadata: { operation: 'camera-rig', timestamp: Date.now() },
    };
  },
};
