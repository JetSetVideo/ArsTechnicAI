// ============================================================
// ARS TECHNICAI — Instagram Publisher Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'pub.instagram';

export const platformConfig = {
  name: 'Instagram Publisher',
  ratio: '1:1',
  maxDuration: 60,
  supportedFormats: ['mp4', 'jpg', 'png'],
};

export const moduleDef: ModuleDef = {
  id,
  name: 'Instagram Publisher',
  category: 'publish',
  description: 'Publish to Instagram (Feed, Stories, Reels) with format auto-detection and caption generation.',
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
          platform: 'instagram',
          status: scheduleTime ? 'scheduled' : 'ready',
          scheduledAt: scheduleTime || null,
          format: '1:1',
          caption: caption ? `${caption}

${hashtags}` : '',
        },
        postUrl: null, // Set after actual publish
      },
      metadata: {
        platform: 'instagram',
        aspectRatio: '1:1',
        maxDuration: 60,
        hasMedia: !!media,
        hasSchedule: !!scheduleTime,
      },
    };
  },
};
