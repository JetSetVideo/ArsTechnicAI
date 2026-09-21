import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = path.join(process.cwd(), '.ars-data');

/**
 * One-time migration: folds a project's legacy freeform-Canvas snapshot
 * (`canvas-{id}.json`, from the now-retired Canvas editor) into that same
 * project's unified Workshop pipeline draft (`pipeline-{id}-draft.json`) —
 * see docs on the Canvas/Workshop merge. Each image `CanvasItem` becomes an
 * `image-import` pipeline node, keeping its canvas position (x/y), prompt,
 * and generation metadata as its one variant. Non-image item types
 * (video/audio/text/shape/drawing) aren't present in any real project today
 * (confirmed against the one existing project's data) — this only migrates
 * what actually exists rather than building untested conversions for
 * hypothetical shapes. Connections/groups/anchors are also not migrated:
 * the source project has none (Canvas connections were never actually used).
 *
 * Idempotent/non-destructive: refuses to run if the pipeline draft already
 * has nodes, unless `force` is passed. The source `canvas-{id}.json` file is
 * left in place (renamed to `.migrated` on success), never deleted.
 */

interface LegacyCanvasItem {
  id: string;
  type: string;
  x: number;
  y: number;
  name?: string;
  src?: string;
  dataUrl?: string;
  prompt?: string;
  visible?: boolean;
  createdAt?: number;
  generationMeta?: {
    prompt?: string;
    model?: string;
    seed?: number;
    generatedAt?: number;
    [key: string]: unknown;
  };
}

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); } }
  const { projectId, force } = body ?? {};
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  const canvasFile = path.join(DATA_DIR, `canvas-${projectId}.json`);
  const draftFile = path.join(DATA_DIR, `pipeline-${projectId}-draft.json`);

  const canvasData = await readJsonSafe<{ projectName?: string; items?: LegacyCanvasItem[] }>(canvasFile);
  if (!canvasData) return res.status(404).json({ error: 'No canvas-*.json found for this project' });

  const existingDraft = await readJsonSafe<{ nodes?: unknown[] }>(draftFile);
  if (existingDraft?.nodes?.length && !force) {
    return res.status(409).json({
      error: 'Pipeline draft already has nodes — pass force:true to merge anyway (existing nodes are kept, migrated ones are appended)',
      existingNodeCount: existingDraft.nodes.length,
    });
  }

  const items = canvasData.items ?? [];
  const migrated: unknown[] = [];
  const skipped: { id: string; type: string; reason: string }[] = [];

  items.forEach((item, i) => {
    const image = item.src || item.dataUrl;
    if (!image) { skipped.push({ id: item.id, type: item.type, reason: 'no src/dataUrl' }); return; }
    if (item.type !== 'generated' && item.type !== 'image') {
      skipped.push({ id: item.id, type: item.type, reason: `type "${item.type}" has no real-project data to verify a conversion against yet` });
      return;
    }
    const variantId = uuidv4();
    const now = item.generationMeta?.generatedAt ?? item.createdAt ?? Date.now();
    migrated.push({
      id: uuidv4(),
      type: 'image-import',
      stage: 'visual',
      title: item.name ?? `Image ${i + 1}`,
      x: item.x,
      y: item.y,
      slot: i,
      params: { file: image },
      status: 'idle',
      variants: [{
        id: variantId,
        label: item.name ?? `Image ${i + 1}`,
        createdAt: now,
        updatedAt: now,
        version: 1,
        image,
        seed: item.generationMeta?.seed,
        paramsSnapshot: item.prompt || item.generationMeta?.prompt
          ? { __prompt: item.prompt ?? item.generationMeta?.prompt }
          : undefined,
        meta: item.generationMeta,
      }],
      activeVariantId: variantId,
    });
  });

  const mergedNodes = [...(existingDraft?.nodes ?? []), ...migrated];

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(draftFile, JSON.stringify({
    projectId,
    projectName: canvasData.projectName || 'Untitled',
    savedAt: Date.now(),
    nodes: mergedNodes,
    edges: [],
    viewport: { x: 60, y: 40, zoom: 0.85 },
    collapsedStages: [],
    scenes: [],
    paramTemplates: [],
  }), 'utf-8');

  // Keep the source file (renamed), never delete outright.
  await fs.rename(canvasFile, `${canvasFile}.migrated`).catch(() => {});

  return res.status(200).json({
    success: true,
    migratedCount: migrated.length,
    skippedCount: skipped.length,
    skipped,
    totalNodesAfterMerge: mergedNodes.length,
  });
}
