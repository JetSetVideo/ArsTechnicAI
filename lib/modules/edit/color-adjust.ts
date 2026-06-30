// ============================================================
// ARS TECHNICAI — Color Adjust Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.color-adjust';

export const moduleDef: ModuleDef = {
  id,
  name: 'Color Adjust',
  category: 'edit',
  description: 'Adjust brightness, contrast, saturation, hue, and temperature of an image. Apply color grading with precision sliders.',
  inputs: [
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input' },
  ],
  outputs: [
    { id: 'image', label: 'Processed Image', type: 'image', direction: 'output' },
  ],
  parameters: [
    { id: 'brightness', label: 'Brightness', type: 'number', default: 0, min: -100, max: 100 },
    { id: 'contrast', label: 'Contrast', type: 'number', default: 0, min: -100, max: 100 },
    { id: 'saturation', label: 'Saturation', type: 'number', default: 0, min: -100, max: 100 },
    { id: 'hue', label: 'Hue Shift', type: 'number', default: 0, min: -180, max: 180 },
    { id: 'temperature', label: 'Temperature', type: 'number', default: 0, min: -100, max: 100 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return {
      outputs: { colorParams: ctx.parameters },
      metadata: { operation: 'color-adjust', params: ctx.parameters },
    };
  },
};
