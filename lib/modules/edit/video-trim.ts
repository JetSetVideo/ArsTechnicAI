// ============================================================
// ARS TECHNICAI — Trim Video Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.video-trim';

export const moduleDef: ModuleDef = {
  id,
  name: 'Trim Video',
  category: 'edit',
  description: 'Trim video to exact time range. Supports frame-accurate cutting with optional re-encoding or stream copy for fast trimming.',
  inputs: [
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input' },
  ],
  outputs: [
    { id: 'image', label: 'Processed Image', type: 'image', direction: 'output' },
  ],
  parameters: [
    { id: 'start', label: 'Start Time (s)', type: 'number', default: 0, min: 0 },
    { id: 'end', label: 'End Time (s)', type: 'number', default: 60, min: 0 },
    { id: 'fastTrim', label: 'Fast Trim (stream copy)', type: 'boolean', default: True },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return {
      outputs: { trimParams: ctx.parameters },
      metadata: { operation: 'video-trim' },
    };
  },
};
