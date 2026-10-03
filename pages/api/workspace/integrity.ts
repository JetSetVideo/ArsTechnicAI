/**
 * GET /api/workspace/integrity — a real check of this machine's project data
 * (replaces the hard-coded "✓ Verified" rows in Settings → Data).
 *
 *   projects    every project file in .ars-data parses
 *   files       every /generated/<file> a project references exists on disk
 *   orphans     generated files no project references (listed, never deleted)
 *   settings    .ars-settings.json and generations.json parse
 *
 * Read-only. Owner over trusted loopback, or a signed-in user.
 */
import fs from 'fs/promises';
import path from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';
import { withPrincipal } from '@/lib/auth/requestAuth';
import { generatedDir, isGeneratedName } from '@/lib/storage/generatedFiles';

const DATA_DIR = path.join(process.cwd(), '.ars-data');
const SETTINGS_FILE = path.join(process.cwd(), '.ars-settings.json');
const PROJECT_FILE = /^(canvas|filestate)-(.+)\.json$|^pipeline-(.+)-draft\.json$/;
const LIST_CAP = 50;

export interface IntegrityReport {
  checkedAt: number;
  projects: { count: number; unreadable: string[] };
  files: { referenced: number; missing: { file: string; projectId: string }[] };
  orphans: { count: number; bytes: number; sample: string[] };
  settings: { ok: boolean; generationsOk: boolean };
}

/** Every "/generated/<plain name>" string anywhere in a JSON value. */
export function generatedRefs(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    // The whole path must be one plain file name (a sub-path's first segment is not a file).
    const m = /^\/generated\/([^/?#]+)(?:[?#].*)?$/.exec(value);
    if (m && isGeneratedName(m[1])) out.add(m[1]);
  } else if (Array.isArray(value)) {
    for (const v of value) generatedRefs(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) generatedRefs(v, out);
  }
  return out;
}

async function parses(file: string): Promise<boolean | null> {
  try {
    JSON.parse(await fs.readFile(file, 'utf-8'));
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'ENOENT' ? null : false;
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const projectIds = new Set<string>();
  const unreadable: string[] = [];
  const refsByProject = new Map<string, Set<string>>();

  let entries: string[] = [];
  try {
    entries = await fs.readdir(DATA_DIR);
  } catch { /* no data yet */ }

  for (const f of entries) {
    const m = PROJECT_FILE.exec(f);
    if (!m) continue;
    const id = m[2] ?? m[3];
    projectIds.add(id);
    try {
      const json = JSON.parse(await fs.readFile(path.join(DATA_DIR, f), 'utf-8'));
      const refs = refsByProject.get(id) ?? new Set<string>();
      generatedRefs(json, refs);
      refsByProject.set(id, refs);
    } catch {
      unreadable.push(f);
    }
  }

  const onDisk = new Map<string, number>();
  try {
    for (const e of await fs.readdir(generatedDir(), { withFileTypes: true })) {
      if (e.isFile() && isGeneratedName(e.name) && e.name !== 'generations.json') {
        onDisk.set(e.name, (await fs.stat(path.join(generatedDir(), e.name))).size);
      }
    }
  } catch { /* no generated files yet */ }

  const referenced = new Set<string>();
  const missing: { file: string; projectId: string }[] = [];
  for (const [projectId, refs] of refsByProject) {
    for (const file of refs) {
      referenced.add(file);
      if (!onDisk.has(file)) missing.push({ file, projectId });
    }
  }
  const orphanNames = [...onDisk.keys()].filter((n) => !referenced.has(n));

  const report: IntegrityReport = {
    checkedAt: Date.now(),
    projects: { count: projectIds.size, unreadable: unreadable.slice(0, LIST_CAP) },
    files: { referenced: referenced.size, missing: missing.slice(0, LIST_CAP) },
    orphans: { count: orphanNames.length, bytes: orphanNames.reduce((s, n) => s + (onDisk.get(n) ?? 0), 0), sample: orphanNames.slice(0, LIST_CAP) },
    settings: {
      ok: (await parses(SETTINGS_FILE)) !== false,
      generationsOk: (await parses(path.join(generatedDir(), 'generations.json'))) !== false,
    },
  };
  return res.status(200).json(report);
}

export default withPrincipal(handler, { allowLocal: true });
