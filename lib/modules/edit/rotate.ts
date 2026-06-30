import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';
export const id = 'edit.rotate';
export const moduleDef: ModuleDef = {
  id, name: 'Rotate Image', category: 'edit',
  description: 'Rotate an image by any angle with configurable background fill color.',
  inputs: [{ id: 'image', label: 'Source Image', type: 'image', direction: 'input' }],
  outputs: [{ id: 'image', label: 'Rotated Image', type: 'image', direction: 'output' }],
  parameters: [
    { id: 'angle', label: 'Rotation Angle', type: 'number', default: 90, min: -360, max: 360, step: 0.1 },
    { id: 'background', label: 'Background Fill', type: 'color', default: '#00000000' },
    { id: 'snap', label: 'Snap to 90°', type: 'boolean', default: false },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return { outputs: { rotationParams: ctx.parameters }, metadata: { operation: 'rotate' } };
  },
};