import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.ars-data');
const SETTINGS_FILE = path.join(process.cwd(), '.ars-settings.json');

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Support sendBeacon (text/plain content type) by parsing string body
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }

  const { canvas, fileState, settings, projectId, projectName, pipeline } = body ?? {};

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });

    // These three can carry base64 image data (canvas items, pipeline
    // variants, file-tree asset thumbnails) and are machine-written/read
    // only — pretty-printing (`null, 2`) roughly doubles write size and CPU
    // for files nobody hand-edits.
    if (canvas && projectId) {
      const canvasFile = path.join(DATA_DIR, `canvas-${projectId}.json`);
      await fs.writeFile(canvasFile, JSON.stringify({
        projectId,
        projectName: projectName || 'Untitled',
        savedAt: Date.now(),
        viewport: canvas.viewport,
        items: canvas.items,
      }), 'utf-8');
    }

    // Save Workshop pipeline draft (per-project — see stores/pipelineStore.ts)
    if (pipeline && projectId) {
      const pipelineFile = path.join(DATA_DIR, `pipeline-${projectId}-draft.json`);
      await fs.writeFile(pipelineFile, JSON.stringify({
        projectId,
        projectName: projectName || 'Untitled',
        savedAt: Date.now(),
        nodes: pipeline.nodes,
        edges: pipeline.edges,
        viewport: pipeline.viewport,
        collapsedStages: pipeline.collapsedStages,
        scenes: pipeline.scenes,
        paramTemplates: pipeline.paramTemplates,
      }), 'utf-8');
    }

    // Save file tree state
    if (fileState && projectId) {
      const fileStateFile = path.join(DATA_DIR, `filestate-${projectId}.json`);
      await fs.writeFile(fileStateFile, JSON.stringify({
        projectId,
        projectName: projectName || 'Untitled',
        savedAt: Date.now(),
        ...fileState,
      }), 'utf-8');
    }

    // Save projects list
    if (body.projects) {
      const projectsFile = path.join(DATA_DIR, 'projects.json');
      await fs.writeFile(projectsFile, JSON.stringify({
        savedAt: Date.now(),
        projects: body.projects,
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
