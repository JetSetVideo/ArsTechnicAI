// ============================================================
// ARS TECHNICAI — YouTube Publisher Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'pub.youtube';

export const platformConfig = {
  name: 'YouTube Publisher',
  ratio: '16:9',
  maxDuration: 43200,
  supportedFormats: ['mp4', 'jpg', 'png'],
};

export const moduleDef: ModuleDef = {
  id,
  name: 'YouTube Publisher',
  category: 'publish',
  description: 'Publish to YouTube with thumbnail generation, SEO title/description, playlist assignment, and scheduling.',
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
          platform: 'youtube',
          status: scheduleTime ? 'scheduled' : 'ready',
          scheduledAt: scheduleTime || null,
          format: '16:9',
          caption: caption ? `${caption}

${hashtags}` : '',
        },
        postUrl: null, // Set after actual publish
      },
      metadata: {
        platform: 'youtube',
        aspectRatio: '16:9',
        maxDuration: 43200,
        hasMedia: !!media,
        hasSchedule: !!scheduleTime,
      },
    };
  },
};
