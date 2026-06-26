import { getImageMetadata, generateThumbnail, generatePreview, extractColorPalette } from './image';
import { probeVideo, generateVideoThumbnail } from './video';
import { probeAudio } from './audio';
import { saveFile } from '@/lib/storage/local';

export interface ProcessedMedia {
  width?: number;
  height?: number;
  duration?: number;
  thumbnailPath?: string;
  previewPath?: string;
  colorPalette?: string[];
  waveformPath?: string;
  filmstripPaths?: string[];
  metadata?: Record<string, unknown>;
}

export async function processMedia(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ProcessedMedia> {
  if (mimeType.startsWith('image/')) {
    return processImage(buffer, filename);
  }
  if (mimeType.startsWith('video/')) {
    return processVideo(buffer, filename);
  }
  if (mimeType.startsWith('audio/')) {
    return processAudio(buffer, filename);
  }
  return { metadata: { mimeType, size: buffer.length } };
}

async function processImage(buffer: Buffer, filename: string): Promise<ProcessedMedia> {
  const meta = await getImageMetadata(buffer);

  const [thumbnailBuf, previewBuf, colorPalette] = await Promise.all([
    generateThumbnail(buffer),
    generatePreview(buffer),
    extractColorPalette(buffer),
  ]);

  const [thumbnailPath, previewPath] = await Promise.all([
    saveFile(thumbnailBuf, `thumb-${filename}`, 'thumbnail'),
    saveFile(previewBuf, `preview-${filename}`, 'preview'),
  ]);

  return {
    width: meta.width,
    height: meta.height,
    thumbnailPath,
    previewPath,
    colorPalette,
    metadata: {
      format: meta.format,
      channels: meta.channels,
      hasAlpha: meta.hasAlpha,
    },
  };
}

async function processVideo(buffer: Buffer, filename: string): Promise<ProcessedMedia> {
  const tempPath = `/tmp/ars-video-${Date.now()}-${filename}`;
  await saveFile(buffer, filename, 'temp');

  try {
    const meta = await probeVideo(tempPath);
    const thumbPath = `thumb-${filename.replace(/\.[^.]+$/, '.jpg')}`;
    await generateVideoThumbnail(tempPath, thumbPath, 1);

    return {
      width: meta.width,
      height: meta.height,
      duration: meta.duration,
      thumbnailPath: thumbPath,
      metadata: {
        codec: meta.codec,
        bitrate: meta.bitrate,
        fps: meta.fps,
        format: meta.codec,
      },
    };
  } catch {
    return { metadata: { mimeType: 'video/*', size: buffer.length } };
  }
}

async function processAudio(buffer: Buffer, filename: string): Promise<ProcessedMedia> {
  const tempPath = `/tmp/ars-audio-${Date.now()}-${filename}`;
  await saveFile(buffer, filename, 'temp');

  try {
    const meta = await probeAudio(tempPath);
    return {
      duration: meta.duration,
      metadata: {
        codec: meta.codec,
        sampleRate: meta.sampleRate,
        channels: meta.channels,
        bitrate: meta.bitrate,
      },
    };
  } catch {
    return { metadata: { mimeType: 'audio/*', size: buffer.length } };
  }
}
