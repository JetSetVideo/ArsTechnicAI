import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';
export const id = 'asm.add.captions';
export const moduleDef: ModuleDef = {
  id, name: 'Add Captions', category: 'assembly',
  description: 'Add text captions to video or image sequences with configurable style, position, and animation.',
  inputs: [{ id: 'input', label: 'Input', type: 'data', direction: 'input', optional: true }],
  outputs: [{ id: 'result', label: 'Result', type: 'data', direction: 'output' }],
  parameters: [
    { id: 'text', label: 'Caption Text', type: 'string', default: '' },
    { id: 'position', label: 'Position', type: 'enum', options: ['bottom', 'top', 'center'], default: 'bottom' },
    { id: 'animation', label: 'Animation', type: 'enum', options: ['none', 'fade', 'slide-up', 'typewriter'], default: 'fade' },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    ctx.onProgress?.(50, 'Processing...');
    return { outputs: { result: ctx.parameters }, metadata: { operation: 'add-captions', timestamp: Date.now() } };
  },
};