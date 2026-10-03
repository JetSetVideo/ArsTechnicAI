/**
 * GET/HEAD /generated/<name> for files created after the production build.
 *
 * Next serves public/ files that existed at build time only, so every image
 * generated or pulled by sync afterwards was a 404 in production (proven on a
 * `next start` build). next.config.js routes /generated/:name here as a
 * *fallback* rewrite — only when no static file matched — so build-time files are
 * still served statically. Same exposure as the static path (backlog S3).
 */
import { createReadStream } from 'fs';
import path from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';
import { generatedPath, isGeneratedName, statGenerated } from '@/lib/storage/generatedFiles';

export const config = { api: { responseLimit: false } };

const TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.json': 'application/json', '.txt': 'text/plain',
};
const MEDIA = /^(image|audio|video)\//;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const name = Array.isArray(req.query.name) ? req.query.name[0] : req.query.name;
  if (!isGeneratedName(name)) return res.status(404).end();
  const st = await statGenerated(name);
  if (!st) return res.status(404).end();

  const type = TYPES[path.extname(name).toLowerCase()] ?? 'application/octet-stream';
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Length', String(st.size));
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (!MEDIA.test(type)) res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  if (req.method === 'HEAD') return res.status(200).end();
  res.status(200);
  createReadStream(generatedPath(name)).on('error', () => res.destroy()).pipe(res);
}
