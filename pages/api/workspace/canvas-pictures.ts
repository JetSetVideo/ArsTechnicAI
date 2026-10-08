import { isSafeId } from '@/lib/security/safePath';
import { picturesFromNodes, type CanvasPicture } from '@/lib/pipeline/canvasPictures';
import { withPrincipal } from '@/lib/auth/requestAuth';
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const DATA_DIR = path.join(process.cwd(), '.ars-data');

interface DraftNode {
  id: string;
  title?: string;
  params?: Record<string, unknown>;
  variants?: Array<{ id: string; label?: string; image?: string; updatedAt?: number; createdAt?: number }>;
}

/** A card-sized preview. The canvas keeps the original; the library only needs to show it. */
async function previewSrc(src: string): Promise<string> {
  if (!src.startsWith('data:image/')) return src;
  const comma = src.indexOf(',');
  if (comma < 0) return src;
  try {
    const jpeg = await sharp(Buffer.from(src.slice(comma + 1), 'base64'))
      .rotate()
      .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 68 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    return src;
  }
}

async function withPreviews(pictures: CanvasPicture[]): Promise<CanvasPicture[]> {
  return Promise.all(pictures.map(async (picture) => ({ ...picture, src: await previewSrc(picture.src) })));
}

/**
 * Pictures sitting on each saved canvas. The dashboard uses these for the
 * project cover and the asset library, instead of a leftover file path.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const files = await fs.readdir(DATA_DIR).catch(() => [] as string[]);
    const projects = [];
    for (const file of files) {
      const match = file.match(/^pipeline-(.+)-draft\.json$/);
      if (!match || !isSafeId(match[1])) continue;
      const raw = await fs.readFile(path.join(DATA_DIR, file), 'utf-8').catch(() => '');
      if (!raw) continue;
      const draft = JSON.parse(raw) as {
        projectName?: string;
        savedAt?: number;
        nodes?: DraftNode[];
      };
      projects.push({
        projectId: match[1],
        projectName: draft.projectName || 'Untitled',
        updatedAt: draft.savedAt || 0,
        pictures: await withPreviews(picturesFromNodes(draft.nodes || [])),
      });
    }
    projects.sort((a, b) => b.updatedAt - a.updatedAt);
    return res.status(200).json({ projects });
  } catch (error) {
    return res.status(500).json({ error: 'Could not read canvas pictures', detail: String(error) });
  }
}

export default withPrincipal(handler, { allowLocal: true });
