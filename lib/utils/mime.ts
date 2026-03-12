import mimeTypes from 'mime-types';
import type { AssetType } from '@prisma/client';

export function getMimeType(filename: string): string {
  return mimeTypes.lookup(filename) || 'application/octet-stream';
}

export function getExtension(mimeType: string): string {
  return mimeTypes.extension(mimeType) || '';
}

export function mimeToAssetType(mimeType: string): AssetType {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  return 'TEXT';
}
