import { getImageMetadata, generateThumbnail, generatePreview, extractColorPalette } from './image';
import { saveFile } from '@/lib/storage/local';

export interface ProcessedMedia {
  width?: number;
  height?: number;
  duration?: number;
  thumbnailPath?: string;
  previewPath?: string;
  colorPalette?: string[];
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
  // Video and audio processing delegated to Phase 8
  return {};
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
