import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';
export const id = 'edit.subtitle.burn';
export const moduleDef: ModuleDef = {
  id, name: 'Burn Subtitles', category: 'edit',
  description: 'Burn subtitles/captions into video. Supports SRT, VTT, ASS formats with configurable style.',
  inputs: [{ id: 'video', label: 'Video', type: 'video', direction: 'input' }],
  outputs: [{ id: 'video', label: 'Video with Subtitles', type: 'video', direction: 'output' }],
  parameters: [
    { id: 'subtitleFile', label: 'Subtitle File', type: 'string', default: '' },
    { id: 'fontSize', label: 'Font Size', type: 'number', default: 24, min: 8, max: 72 },
    { id: 'color', label: 'Text Color', type: 'color', default: '#ffffff' },
    { id: 'outline', label: 'Outline Width', type: 'number', default: 1, min: 0, max: 5 },
    { id: 'position', label: 'Position', type: 'enum', options: ['bottom', 'top', 'middle'], default: 'bottom' },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    return { outputs: { subtitleParams: ctx.parameters }, metadata: { operation: 'subtitle-burn' } };
  },
};