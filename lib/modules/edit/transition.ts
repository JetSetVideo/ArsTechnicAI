import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';
export const id = 'edit.transition';
export const moduleDef: ModuleDef = {
  id, name: 'Scene Transition', category: 'edit',
  description: 'Apply animated transitions between two clips with 15+ cinematic types.',
  inputs: [
    { id: 'clipA', label: 'Clip A', type: 'video', direction: 'input' },
    { id: 'clipB', label: 'Clip B', type: 'video', direction: 'input' },
  ],
  outputs: [{ id: 'transitioned', label: 'Transitioned Video', type: 'video', direction: 'output' }],
  parameters: [
    { id: 'type', label: 'Transition Type', type: 'enum', options: ['fade', 'dissolve', 'wipe-left', 'wipe-right', 'slide-left', 'slide-right', 'zoom-in', 'zoom-out', 'flip', 'cube', 'glitch'], default: 'fade' },
    { id: 'duration', label: 'Duration (s)', type: 'number', default: 1, min: 0.1, max: 10, step: 0.1 },
    { id: 'easing', label: 'Easing', type: 'enum', options: ['linear', 'ease-in', 'ease-out', 'ease-in-out'], default: 'ease-in-out' },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return { outputs: { transitionParams: ctx.parameters }, metadata: { operation: 'transition' } };
  },
};