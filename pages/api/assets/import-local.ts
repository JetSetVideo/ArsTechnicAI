import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

const ALLOWED_EXTENSIONS: Record<string, string> = {
  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.exr': 'image/x-exr',
  '.hdr': 'image/vnd.radiance',
  // Video
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
  '.m4v': 'video/x-m4v',
  '.ogv': 'video/ogg',
  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.m4a': 'audio/x-m4a',
  '.wma': 'audio/x-ms-wma',
  '.aiff': 'audio/aiff',
  '.opus': 'audio/opus',
  // Text
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.srt': 'text/srt',
  '.vtt': 'text/vtt',
  '.xml': 'text/xml',
  '.html': 'text/html',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB

function isPathTraversal(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  const normalized = path.normalize(filePath);
  if (normalized.includes('..')) return true;
  if (resolved !== normalized && resolved !== path.resolve(normalized)) return true;
  return false;
}

function isSystemPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const blocked = [
    '/etc/', '/var/', '/usr/', '/bin/', '/sbin/', '/sys/', '/proc/',
    '/dev/', '/boot/', '/root/',
    'c:\\windows', 'c:\\program files', 'c:\\system',
    '/system/', '/private/etc/',
  ];
  return blocked.some((p) => lower.startsWith(p));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { filePaths } = req.body as { filePaths?: string[] };

  if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
    return res.status(400).json({ success: false, error: 'No file paths provided' });
  }

  if (filePaths.length > 100) {
    return res.status(400).json({ success: false, error: 'Too many files (max 100)' });
  }

  const results: Array<{
    localPath: string;
    name: string;
    mimeType: string;
    size: number;
    exists: boolean;
    valid: boolean;
    error?: string;
  }> = [];

  for (const rawPath of filePaths) {
    if (typeof rawPath !== 'string' || rawPath.trim().length === 0) {
      results.push({ localPath: rawPath, name: '', mimeType: '', size: 0, exists: false, valid: false, error: 'Invalid path' });
      continue;
    }

    const filePath = path.resolve(rawPath.trim());

    if (isPathTraversal(rawPath)) {
      results.push({ localPath: filePath, name: path.basename(filePath), mimeType: '', size: 0, exists: false, valid: false, error: 'Path traversal detected' });
      continue;
    }

    if (isSystemPath(filePath)) {
      results.push({ localPath: filePath, name: path.basename(filePath), mimeType: '', size: 0, exists: false, valid: false, error: 'System path not allowed' });
      continue;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ALLOWED_EXTENSIONS[ext];

    if (!mimeType) {
      results.push({ localPath: filePath, name: path.basename(filePath), mimeType: '', size: 0, exists: false, valid: false, error: `Unsupported file type: ${ext || 'none'}` });
      continue;
    }

    try {
      const stat = await fs.stat(filePath);

      if (!stat.isFile()) {
        results.push({ localPath: filePath, name: path.basename(filePath), mimeType, size: 0, exists: false, valid: false, error: 'Not a file' });
        continue;
      }

      if (stat.size > MAX_FILE_SIZE) {
        results.push({ localPath: filePath, name: path.basename(filePath), mimeType, size: stat.size, exists: true, valid: false, error: 'File too large (max 10 GB)' });
        continue;
      }

      if (stat.size === 0) {
        results.push({ localPath: filePath, name: path.basename(filePath), mimeType, size: 0, exists: true, valid: false, error: 'File is empty' });
        continue;
      }

      results.push({
        localPath: filePath,
        name: path.basename(filePath),
        mimeType,
        size: stat.size,
        exists: true,
        valid: true,
      });
    } catch {
      results.push({ localPath: filePath, name: path.basename(filePath), mimeType, size: 0, exists: false, valid: false, error: 'File not found or inaccessible' });
    }
  }

  return res.status(200).json({ success: true, data: results });
}
