// ============================================================
// ARS TECHNICAI — Replace Background Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.background-replace';

export const moduleDef: ModuleDef = {
  id,
  name: 'Replace Background',
  category: 'edit',
  description: 'Replace image background with a solid color, gradient, or another image. Automatically detects and segments the subject first.',
  inputs: [
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input' },
  ],
  outputs: [
    { id: 'image', label: 'Processed Image', type: 'image', direction: 'output' },
  ],
  parameters: [
    { id: 'color', label: 'Background Color', type: 'color', default: #ffffff },
    { id: 'blur', label: 'Background Blur', type: 'number', default: 0, min: 0, max: 50 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return {
      outputs: { bgReplaceParams: { color: ctx.parameters.color || '#ffffff', blur: ctx.parameters.blur || 0 } },
      metadata: { operation: 'background-replace' },
    };
  },
};
