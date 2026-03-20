import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

interface DiskAsset {
  filename: string;
  filePath: string;
  url: string;
  sizeBytes: number;
  modifiedAt: number;
  meta?: {
    id?: string;
    prompt?: string;
    negativePrompt?: string;
    model?: string;
    seed?: number;
    width?: number;
    height?: number;
    generatedAt?: number;
    parentIds?: string[];
    childIds?: string[];
    imageVersion?: number;
    variations?: { id: string; label: string; filePath?: string }[];
  };
}

interface ScanResult {
  assets: DiskAsset[];
  settingsOnDisk: Record<string, unknown> | null;
}

const GENERATED_DIR = path.join(process.cwd(), 'public', 'generated');
const META_FILE = path.join(GENERATED_DIR, 'generations.json');
const SETTINGS_FILE = path.join(process.cwd(), '.ars-settings.json');

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg']);

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  if (_req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result: ScanResult = { assets: [], settingsOnDisk: null };

    // 1. Read generations metadata index
    let metaIndex: Record<string, DiskAsset['meta']> = {};
    try {
      const raw = await fs.readFile(META_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.generations)) {
        for (const gen of parsed.generations) {
          const fname = gen.filePath?.split('/').pop();
          if (fname) metaIndex[fname] = gen;
        }
      }
    } catch {
      // No meta file or corrupt — proceed without metadata
    }

    // 2. Scan generated directory for actual image files
    try {
      const entries = await fs.readdir(GENERATED_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (!IMAGE_EXTS.has(ext)) continue;

        const filePath = path.join(GENERATED_DIR, entry.name);
        const stat = await fs.stat(filePath);
        const meta = metaIndex[entry.name] || undefined;

        result.assets.push({
          filename: entry.name,
          filePath: `/generated/${entry.name}`,
          url: `/generated/${entry.name}`,
          sizeBytes: stat.size,
          modifiedAt: stat.mtimeMs,
          meta,
        });
      }

      result.assets.sort((a, b) => b.modifiedAt - a.modifiedAt);
    } catch {
      // Directory doesn't exist yet
    }

    // 3. Read settings from disk if present
    try {
      const raw = await fs.readFile(SETTINGS_FILE, 'utf-8');
      result.settingsOnDisk = JSON.parse(raw);
    } catch {
      // No settings file
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Scan failed', detail: String(error) });
  }
}
