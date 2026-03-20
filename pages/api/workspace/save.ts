import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.ars-data');
const SETTINGS_FILE = path.join(process.cwd(), '.ars-settings.json');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { canvas, fileState, settings, projectId, projectName } = req.body ?? {};

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });

    // Save canvas state
    if (canvas && projectId) {
      const canvasFile = path.join(DATA_DIR, `canvas-${projectId}.json`);
      await fs.writeFile(canvasFile, JSON.stringify({
        projectId,
        projectName: projectName || 'Untitled',
        savedAt: Date.now(),
        viewport: canvas.viewport,
        items: canvas.items,
      }, null, 2), 'utf-8');
    }

    // Save file tree state
    if (fileState && projectId) {
      const fileStateFile = path.join(DATA_DIR, `filestate-${projectId}.json`);
      await fs.writeFile(fileStateFile, JSON.stringify({
        projectId,
        projectName: projectName || 'Untitled',
        savedAt: Date.now(),
        ...fileState,
      }, null, 2), 'utf-8');
    }

    // Save projects list
    if (req.body.projects) {
      const projectsFile = path.join(DATA_DIR, 'projects.json');
      await fs.writeFile(projectsFile, JSON.stringify({
        savedAt: Date.now(),
        projects: req.body.projects,
      }, null, 2), 'utf-8');
    }

    // Save settings (API keys, preferences) to dedicated file
    if (settings) {
      await fs.writeFile(SETTINGS_FILE, JSON.stringify({
        savedAt: Date.now(),
        settings,
      }, null, 2), 'utf-8');
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Save failed', detail: String(error) });
  }
}
