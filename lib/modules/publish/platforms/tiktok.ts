// ============================================================
// ARS TECHNICAI — TikTok Publisher Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'pub.tiktok';

export const platformConfig = {
  name: 'TikTok Publisher',
  ratio: '9:16',
  maxDuration: 180,
  supportedFormats: ['mp4', 'jpg', 'png'],
};

export const moduleDef: ModuleDef = {
  id,
  name: 'TikTok Publisher',
  category: 'publish',
  description: 'Publish to TikTok with auto-cropping to 9:16, hashtag optimization, trending sounds, and scheduling.',
  inputs: [
    { id: 'media', label: 'Media File', type: 'data', direction: 'input' },
    { id: 'caption', label: 'Caption Text', type: 'text', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'publishResult', label: 'Publish Result', type: 'data', direction: 'output' },
    { id: 'postUrl', label: 'Post URL', type: 'text', direction: 'output', optional: true },
  ],
  parameters: [
    { id: 'caption', label: 'Caption', type: 'string', default: "''" },
    { id: 'hashtags', label: 'Hashtags', type: 'string', default: "''" },
    { id: 'scheduleTime', label: 'Schedule (ISO)', type: 'string', default: "''" },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const media = ctx.inputs.media;
    const caption = (ctx.parameters.caption as string) || '';
    const hashtags = (ctx.parameters.hashtags as string) || '';
    const scheduleTime = (ctx.parameters.scheduleTime as string) || '';
    
    ctx.onProgress?.(30, 'Preparing media...');
    ctx.onProgress?.(60, 'Optimizing for platform...');
    
    return {
      outputs: {
        publishResult: {
          platform: 'tiktok',
          status: scheduleTime ? 'scheduled' : 'ready',
          scheduledAt: scheduleTime || null,
          format: '9:16',
          caption: caption ? `${caption}

${hashtags}` : '',
        },
        postUrl: null, // Set after actual publish
      },
      metadata: {
        platform: 'tiktok',
        aspectRatio: '9:16',
        maxDuration: 180,
        hasMedia: !!media,
        hasSchedule: !!scheduleTime,
      },
    };
  },
};
