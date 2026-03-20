import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.ars-data');
const SETTINGS_FILE = path.join(process.cwd(), '.ars-settings.json');

async function readJsonSafe(filePath: string): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { projectId } = req.query;

  try {
    const result: Record<string, unknown> = {};

    // Load canvas for project
    if (projectId && typeof projectId === 'string') {
      result.canvas = await readJsonSafe(path.join(DATA_DIR, `canvas-${projectId}.json`));
      result.fileState = await readJsonSafe(path.join(DATA_DIR, `filestate-${projectId}.json`));
    }

    // Load projects list
    result.projects = await readJsonSafe(path.join(DATA_DIR, 'projects.json'));

    // Load settings
    result.settings = await readJsonSafe(SETTINGS_FILE);

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Load failed', detail: String(error) });
  }
}
