import sharp from 'sharp';

const THUMBNAIL_WIDTH = parseInt(process.env.THUMBNAIL_WIDTH || '400');
const THUMBNAIL_HEIGHT = parseInt(process.env.THUMBNAIL_HEIGHT || '400');
const THUMBNAIL_QUALITY = parseInt(process.env.THUMBNAIL_QUALITY || '80');

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  channels: number;
  size: number;
  hasAlpha: boolean;
}

export async function getImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
  const meta = await sharp(buffer).metadata();
  return {
    width: meta.width || 0,
    height: meta.height || 0,
    format: meta.format || 'unknown',
    channels: meta.channels || 0,
    size: meta.size || buffer.length,
    hasAlpha: meta.hasAlpha || false,
  };
}

export async function generateThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, { fit: 'cover', position: 'center' })
    .jpeg({ quality: THUMBNAIL_QUALITY })
    .toBuffer();
}

export async function generatePreview(buffer: Buffer, maxWidth = 1200): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const width = Math.min(meta.width || maxWidth, maxWidth);
  return sharp(buffer)
    .resize(width, undefined, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

export async function extractColorPalette(buffer: Buffer, count = 6): Promise<string[]> {
  const { data, info } = await sharp(buffer)
    .resize(50, 50, { fit: 'cover' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const colors: Map<string, number> = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    const r = Math.round(data[i] / 32) * 32;
    const g = Math.round(data[i + 1] / 32) * 32;
    const b = Math.round(data[i + 2] / 32) * 32;
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    colors.set(hex, (colors.get(hex) || 0) + 1);
  }

  return [...colors.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([color]) => color);
}
