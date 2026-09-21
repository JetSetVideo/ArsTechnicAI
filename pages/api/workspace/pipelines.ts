import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = path.join(process.cwd(), '.ars-data');

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

interface SnapshotMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
  sceneCount: number;
}

async function readJsonSafe<T = unknown>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function indexFile(projectId: string) {
  return path.join(DATA_DIR, `pipeline-${projectId}-snapshots.json`);
}
function snapshotFile(projectId: string, snapshotId: string) {
  return path.join(DATA_DIR, `pipeline-${projectId}-snap-${snapshotId}.json`);
}
function draftFile(projectId: string) {
  return path.join(DATA_DIR, `pipeline-${projectId}-draft.json`);
}

async function readIndex(projectId: string): Promise<SnapshotMeta[]> {
  const data = await readJsonSafe<{ snapshots: SnapshotMeta[] }>(indexFile(projectId));
  return data?.snapshots ?? [];
}

async function writeIndex(projectId: string, snapshots: SnapshotMeta[]): Promise<void> {
  await fs.writeFile(indexFile(projectId), JSON.stringify({ snapshots }, null, 2), 'utf-8');
}

/** Lists every project that has any saved Workshop pipeline data (draft or snapshot). */
async function listAllProjects(): Promise<Array<{ projectId: string; projectName: string; updatedAt: number; nodeCount: number; sceneCount: number; snapshotCount: number }>> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const files = await fs.readdir(DATA_DIR);
  const draftIds = new Set<string>();
  for (const f of files) {
    const m = f.match(/^pipeline-(.+)-draft\.json$/);
    if (m) draftIds.add(m[1]);
    const sm = f.match(/^pipeline-(.+)-snapshots\.json$/);
    if (sm) draftIds.add(sm[1]);
  }
  const results = [];
  for (const projectId of draftIds) {
    const draft = await readJsonSafe<{ projectName?: string; savedAt?: number; nodes?: unknown[]; scenes?: unknown[] }>(draftFile(projectId));
    const snapshots = await readIndex(projectId);
    results.push({
      projectId,
      projectName: draft?.projectName || snapshots[0]?.name || 'Untitled',
      updatedAt: draft?.savedAt ?? Math.max(0, ...snapshots.map((s) => s.updatedAt)),
      nodeCount: draft?.nodes?.length ?? 0,
      sceneCount: draft?.scenes?.length ?? 0,
      snapshotCount: snapshots.length,
    });
  }
  results.sort((a, b) => b.updatedAt - a.updatedAt);
  return results;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    if (req.method === 'GET') {
      const { projectId, snapshotId } = req.query;

      if (typeof projectId === 'string' && typeof snapshotId === 'string') {
        // Load one snapshot's full payload
        const data = await readJsonSafe(snapshotFile(projectId, snapshotId));
        if (!data) return res.status(404).json({ error: 'Snapshot not found' });
        return res.status(200).json(data);
      }

      if (typeof projectId === 'string') {
        // List this project's draft + named snapshots
        const draft = await readJsonSafe<{ projectName?: string; savedAt?: number; nodes?: unknown[]; scenes?: unknown[] }>(draftFile(projectId));
        const snapshots = await readIndex(projectId);
        return res.status(200).json({
          draft: draft ? { updatedAt: draft.savedAt, nodeCount: draft.nodes?.length ?? 0, sceneCount: draft.scenes?.length ?? 0 } : null,
          snapshots,
        });
      }

      // No projectId: list every project's saved workflow (home page menu)
      return res.status(200).json({ projects: await listAllProjects() });
    }

    if (req.method === 'POST') {
      // Create a named snapshot from the given pipeline payload
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { projectId, name, nodes, edges, viewport, collapsedStages, scenes, paramTemplates } = body ?? {};
      if (!projectId || !name) return res.status(400).json({ error: 'projectId and name are required' });

      const snapshotId = uuidv4();
      const now = Date.now();
      await fs.writeFile(snapshotFile(projectId, snapshotId), JSON.stringify({
        projectId, name, nodes, edges, viewport, collapsedStages, scenes, paramTemplates, savedAt: now,
      }, null, 2), 'utf-8');

      const meta: SnapshotMeta = {
        id: snapshotId, name, createdAt: now, updatedAt: now,
        nodeCount: Array.isArray(nodes) ? nodes.length : 0,
        sceneCount: Array.isArray(scenes) ? scenes.length : 0,
      };
      const index = await readIndex(projectId);
      await writeIndex(projectId, [...index, meta]);
      return res.status(200).json({ success: true, snapshot: meta });
    }

    if (req.method === 'PATCH') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { projectId, snapshotId, name } = body ?? {};
      if (!projectId || !snapshotId || !name) return res.status(400).json({ error: 'projectId, snapshotId and name are required' });
      const index = await readIndex(projectId);
      const next = index.map((s) => (s.id === snapshotId ? { ...s, name, updatedAt: Date.now() } : s));
      await writeIndex(projectId, next);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { projectId, snapshotId } = req.query;
      if (typeof projectId !== 'string' || typeof snapshotId !== 'string') {
        return res.status(400).json({ error: 'projectId and snapshotId are required' });
      }
      const index = await readIndex(projectId);
      await writeIndex(projectId, index.filter((s) => s.id !== snapshotId));
      await fs.unlink(snapshotFile(projectId, snapshotId)).catch(() => {});
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: 'Pipeline workflow operation failed', detail: String(error) });
  }
}
