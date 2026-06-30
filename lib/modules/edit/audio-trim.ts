// ============================================================
// ARS TECHNICAI — Trim Audio Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.audio-trim';

export const moduleDef: ModuleDef = {
  id,
  name: 'Trim Audio',
  category: 'edit',
  description: 'Trim audio to a specific time range. Supports fade-in and fade-out at trim boundaries for seamless cuts.',
  inputs: [
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input' },
  ],
  outputs: [
    { id: 'image', label: 'Processed Image', type: 'image', direction: 'output' },
  ],
  parameters: [
    { id: 'start', label: 'Start Time (s)', type: 'number', default: 0, min: 0 },
    { id: 'end', label: 'End Time (s)', type: 'number', default: 30, min: 0 },
    { id: 'fadeIn', label: 'Fade In (ms)', type: 'number', default: 0, min: 0, max: 10000 },
    { id: 'fadeOut', label: 'Fade Out (ms)', type: 'number', default: 0, min: 0, max: 10000 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return {
      outputs: { trimParams: ctx.parameters },
      metadata: { operation: 'audio-trim' },
    };
  },
};
