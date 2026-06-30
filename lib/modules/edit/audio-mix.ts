// ============================================================
// ARS TECHNICAI — Audio Mixer Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.audio-mix';

export const moduleDef: ModuleDef = {
  id,
  name: 'Audio Mixer',
  category: 'edit',
  description: 'Mix multiple audio tracks with individual volume, pan, solo, and mute controls. Export as stereo or multi-channel.',
  inputs: [
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input' },
  ],
  outputs: [
    { id: 'image', label: 'Processed Image', type: 'image', direction: 'output' },
  ],
  parameters: [
    { id: 'tracks', label: 'Track Volumes (JSON)', type: 'json', default: {"track1": 0.8, "track2": 0.5} },
    { id: 'masterVolume', label: 'Master Volume', type: 'number', default: 0.9, min: 0, max: 1, step: 0.01 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return {
      outputs: { mixParams: ctx.parameters },
      metadata: { operation: 'audio-mix' },
    };
  },
};
