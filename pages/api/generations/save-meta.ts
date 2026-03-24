import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

export interface GenerationRecord {
  id: string;
  prompt: string;
  negativePrompt?: string;
  model: string;
  seed: number;
  width: number;
  height: number;
  generatedAt: number;
  filePath?: string;
  parentIds?: string[];
  childIds?: string[];
  imageVersion: number;
  imageVersionLabel?: string;
  variations?: { id: string; label: string; width?: number; height?: number; filePath?: string }[];
  variationSizes?: { width: number; height: number; label: string }[];
  canvasItemId?: string;
  position?: { x: number; y: number };
  layer?: { zIndex?: number; scale?: number; rotation?: number; visible?: boolean; locked?: boolean; opacity?: number };
  layerAssociations?: { parentCanvasItemIds?: string[]; childCanvasItemIds?: string[] };
  projectId?: string;
  projectName?: string;
}

interface MetaFile {
  version: 1;
  generations: GenerationRecord[];
  updatedAt: number;
}

const META_DIR = path.join(process.cwd(), 'public', 'generated');
const META_FILE = path.join(META_DIR, 'generations.json');

async function readMetaFile(): Promise<MetaFile> {
  try {
    const raw = await fs.readFile(META_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { version: 1, generations: [], updatedAt: Date.now() };
  }
}

async function writeMetaFile(meta: MetaFile): Promise<void> {
  await fs.mkdir(META_DIR, { recursive: true });
  await fs.writeFile(META_FILE, JSON.stringify(meta, null, 2), 'utf-8');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const record: GenerationRecord = req.body;
    if (!record.id || !record.prompt) {
      return res.status(400).json({ error: 'Missing required fields (id, prompt)' });
    }

    const meta = await readMetaFile();
    const idx = meta.generations.findIndex((g) => g.id === record.id);
    if (idx >= 0) {
      meta.generations[idx] = record;
    } else {
      meta.generations.push(record);
    }
    meta.updatedAt = Date.now();
    await writeMetaFile(meta);

    return res.status(200).json({ success: true, totalGenerations: meta.generations.length });
  }

  if (req.method === 'GET') {
    const meta = await readMetaFile();
    return res.status(200).json(meta);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
