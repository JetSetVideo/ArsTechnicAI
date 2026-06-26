// ============================================================
// ARS TECHNICAI — Video Filmstrip Extractor Module
// Phase 1.6: Extract frame thumbnails at intervals from video
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.extract.filmstrip';

export const moduleDef: ModuleDef = {
  id,
  name: 'Video Filmstrip',
  category: 'ingest',
  description: 'Extract frame thumbnail images at regular intervals from a video',
  library: 'HTMLVideoElement + Canvas2D',
  inputs: [
    { id: 'video', name: 'Video', type: 'video', required: true, description: 'VideoRef or data URL' },
  ],
  outputs: [
    { id: 'frames', name: 'Frames', type: 'image', array: true, description: 'Array of frame thumbnail data URLs' },
  ],
  parameters: [
    { id: 'frameCount', name: 'Frame Count', type: 'number', default: 8 },
    { id: 'frameWidth', name: 'Frame Width', type: 'number', default: 160 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const videoRef = ctx.inputs.video as { src: string; duration?: number } | string | undefined;
    if (!videoRef) {
      return { outputs: {}, error: 'No video provided for filmstrip extraction' };
    }

    const src = typeof videoRef === 'string' ? videoRef : videoRef.src;
    const frameCount = (ctx.params.frameCount as number) ?? 8;
    const frameWidth = (ctx.params.frameWidth as number) ?? 160;

    const video = await new Promise<HTMLVideoElement>((resolve, reject) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.crossOrigin = 'anonymous';
      v.onloadedmetadata = () => resolve(v);
      v.onerror = reject;
      v.src = src;
    });

    const duration = video.duration || 0;
    if (duration === 0) {
      return { outputs: {}, error: 'Video has no duration' };
    }

    const aspectRatio = video.videoHeight / video.videoWidth || 9 / 16;
    const frameHeight = Math.round(frameWidth * aspectRatio);

    const canvas = document.createElement('canvas');
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) {
      return { outputs: {}, error: 'Canvas 2D context not available' };
    }

    const frames: string[] = [];
    for (let i = 0; i < frameCount; i++) {
      const time = (duration / (frameCount + 1)) * (i + 1);
      video.currentTime = time;
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });
      ctx2d.drawImage(video, 0, 0, frameWidth, frameHeight);
      frames.push(canvas.toDataURL('image/jpeg', 0.7));
    }

    return {
      outputs: { frames },
      logs: [`Extracted ${frames.length} filmstrip frames from ${duration.toFixed(1)}s video`],
    };
  },
};
