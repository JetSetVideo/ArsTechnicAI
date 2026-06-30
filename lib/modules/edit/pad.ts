import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';
export const id = 'edit.pad';
export const moduleDef: ModuleDef = {
  id, name: 'Pad / Extend', category: 'edit',
  description: 'Add padding/extension around an image with configurable color, mirroring, or AI outpainting.',
  inputs: [{ id: 'image', label: 'Source Image', type: 'image', direction: 'input' }],
  outputs: [{ id: 'image', label: 'Processed Image', type: 'image', direction: 'output' }],
  parameters: [
    { id: 'top', label: 'Top', type: 'number', default: 0, min: 0, max: 4096 },
    { id: 'right', label: 'Right', type: 'number', default: 0, min: 0, max: 4096 },
    { id: 'bottom', label: 'Bottom', type: 'number', default: 0, min: 0, max: 4096 },
    { id: 'left', label: 'Left', type: 'number', default: 0, min: 0, max: 4096 },
    { id: 'fillColor', label: 'Fill Color', type: 'color', default: '#000000' },
    { id: 'mode', label: 'Fill Mode', type: 'enum', options: ['solid', 'mirror', 'repeat', 'ai-outpaint'], default: 'solid' },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return { outputs: { padParams: ctx.parameters }, metadata: { operation: 'pad' } };
  },
};