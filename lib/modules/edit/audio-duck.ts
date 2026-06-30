// ============================================================
// ARS TECHNICAI — Audio Ducking Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.audio-duck';

export const moduleDef: ModuleDef = {
  id,
  name: 'Audio Ducking',
  category: 'edit',
  description: 'Automatically lower background music volume when speech or voiceover is detected. Configurable duck amount, attack, and release times.',
  inputs: [
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input' },
  ],
  outputs: [
    { id: 'image', label: 'Processed Image', type: 'image', direction: 'output' },
  ],
  parameters: [
    { id: 'amount', label: 'Duck Amount (dB)', type: 'number', default: -12, min: -40, max: 0 },
    { id: 'attack', label: 'Attack (ms)', type: 'number', default: 50, min: 0, max: 5000 },
    { id: 'release', label: 'Release (ms)', type: 'number', default: 300, min: 0, max: 5000 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return {
      outputs: { duckParams: ctx.parameters },
      metadata: { operation: 'audio-duck' },
    };
  },
};
