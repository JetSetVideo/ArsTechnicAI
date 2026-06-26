// ============================================================
// ARS TECHNICAI — Video Decoder Module
// Phase 1.3: Decode video + extract metadata + generate filmstrip frames
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.decode.video';

export interface VideoMeta {
  width: number;
  height: number;
  duration: number;
  fps: number;
  codec: string;
  bitrate: number;
  format: string;
}

export interface VideoRef {
  src: string;
  duration: number;
  width: number;
  height: number;
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Video Decoder',
  category: 'ingest',
  description: 'Decode video Blob, extract metadata, generate filmstrip frame thumbnails',
  library: 'fluent-ffmpeg (server) / HTMLVideoElement (client)',
  inputs: [
    { id: 'file', name: 'File', type: 'data', required: true, description: 'Video Blob or File' },
  ],
  outputs: [
    { id: 'video', name: 'Video', type: 'video', description: 'VideoRef with src and dimensions' },
    { id: 'metadata', name: 'Metadata', type: 'data', description: 'VideoMeta object' },
    { id: 'filmstrip', name: 'Filmstrip', type: 'image', array: true, description: 'Frame thumbnail data URLs' },
  ],
  parameters: [
    { id: 'filmstripFrames', name: 'Filmstrip Frames', type: 'number', default: 8, description: 'Number of frame thumbnails to extract' },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const file = ctx.inputs.file as File | Blob | undefined;
    if (!file) {
      return { outputs: {}, error: 'No video file provided' };
    }

    const blob = file instanceof File ? file : new File([file], 'video', { type: 'video/mp4' });
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Extract metadata via HTMLVideoElement
    const video = await new Promise<HTMLVideoElement>((resolve, reject) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => resolve(v);
      v.onerror = reject;
      v.src = dataUrl;
    });

    const metadata: VideoMeta = {
      width: video.videoWidth,
      height: video.videoHeight,
      duration: video.duration || 0,
      fps: 0, // Cannot detect from HTMLVideoElement alone
      codec: 'unknown',
      bitrate: 0,
      format: blob.type.replace('video/', '') || 'unknown',
    };

    const videoRef: VideoRef = {
      src: dataUrl,
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
    };

    // Generate filmstrip frames by seeking to intervals
    const frameCount = (ctx.params.filmstripFrames as number) ?? 8;
    const frames: string[] = [];

    if (metadata.duration > 0 && frameCount > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx2d = canvas.getContext('2d');

      for (let i = 0; i < frameCount; i++) {
        const time = (metadata.duration / (frameCount + 1)) * (i + 1);
        video.currentTime = time;
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
        });
        if (ctx2d) {
          ctx2d.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL('image/jpeg', 0.7));
        }
      }
    }

    return {
      outputs: {
        video: videoRef,
        metadata,
        filmstrip: frames,
      },
      logs: [`Decoded video: ${metadata.width}x${metadata.height}, ${metadata.duration.toFixed(1)}s, ${frames.length} filmstrip frames`],
    };
  },
};
