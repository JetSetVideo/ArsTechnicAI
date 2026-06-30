// ============================================================
// ARS TECHNICAI — Normalize Audio Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.audio-normalize';

export const moduleDef: ModuleDef = {
  id,
  name: 'Normalize Audio',
  category: 'edit',
  description: 'Normalize audio to a target loudness level (LUFS, RMS, or peak). Supports EBU R128 broadcast standard.',
  inputs: [
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input' },
  ],
  outputs: [
    { id: 'image', label: 'Processed Image', type: 'image', direction: 'output' },
  ],
  parameters: [
    { id: 'targetLUFS', label: 'Target LUFS', type: 'number', default: -14, min: -30, max: 0 },
    { id: 'mode', label: 'Mode', type: 'enum', default: lufs, options: ['lufs', 'rms', 'peak'] },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return {
      outputs: { normalizeParams: ctx.parameters },
      metadata: { operation: 'audio-normalize' },
    };
  },
};
