import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';
export const id = 'pub.schedule';
export const moduleDef: ModuleDef = {
  id, name: 'Schedule Post', category: 'publish',
  description: 'Schedule social media posts with configurable date, time, platform, caption, and hashtags.',
  inputs: [{ id: 'input', label: 'Input Data', type: 'data', direction: 'input', optional: true }],
  outputs: [{ id: 'result', label: 'Result', type: 'data', direction: 'output' }],
  parameters: [
    { id: 'platform', label: 'Platform', type: 'enum', options: ['instagram', 'youtube', 'tiktok', 'twitter', 'facebook', 'linkedin'], default: 'instagram' },
    { id: 'scheduledAt', label: 'Schedule Time (ISO)', type: 'string', default: '' },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    ctx.onProgress?.(50, 'Processing...');
    return { outputs: { result: ctx.parameters }, metadata: { operation: 'schedule', timestamp: Date.now() } };
  },
};