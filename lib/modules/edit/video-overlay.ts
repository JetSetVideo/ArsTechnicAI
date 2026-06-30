// ============================================================
// ARS TECHNICAI — Video Overlay Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.video-overlay';

export const moduleDef: ModuleDef = {
  id,
  name: 'Video Overlay',
  category: 'edit',
  description: 'Overlay images, text, or another video on top of a video track with position, scale, opacity, and timing controls.',
  inputs: [
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input' },
  ],
  outputs: [
    { id: 'image', label: 'Processed Image', type: 'image', direction: 'output' },
  ],
  parameters: [
    { id: 'x', label: 'X Position', type: 'number', default: 0 },
    { id: 'y', label: 'Y Position', type: 'number', default: 0 },
    { id: 'scale', label: 'Scale', type: 'number', default: 0.3, min: 0.01, max: 5 },
    { id: 'opacity', label: 'Opacity', type: 'number', default: 80, min: 0, max: 100 },
    { id: 'startTime', label: 'Start Time (s)', type: 'number', default: 0, min: 0 },
    { id: 'endTime', label: 'End Time (s)', type: 'number', default: 10, min: 0 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return {
      outputs: { videoOverlayParams: ctx.parameters },
      metadata: { operation: 'video-overlay' },
    };
  },
};
