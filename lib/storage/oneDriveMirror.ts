/**
 * Human-readable mirror of synced projects into OneDrive.
 *
 *   <ARS_ONEDRIVE_DIR>/<Project name>-<id8>/
 *     <asset file name>              ← the original file, by its own name
 *     project.arstechnic.json        ← the project bundle (canvas, pipeline, file tree)
 *     .arstechnicai-manifest.json    ← file → assetId / sha256 / size / updatedAt
 *
 * The OneDrive client (abraunegg `onedrive --monitor`) uploads it, and the Mac's
 * OneDrive app brings the same folder down — the assets stay browsable in Finder
 * even when this server is unreachable.
 *
 * Guarantees:
 * - Writes are atomic: a `.~ars-*.tmp` file (the client's default skip_file
 *   pattern `~*|.~*|*.tmp`) renamed into place, so half-written files never upload.
 * - A different file never overwrites an existing name: it gets " (<sha8>)".
 * - Mirroring is best-effort; a failure is logged and never fails the sync.
 *
 * ARS_ONEDRIVE_DIR: target folder. Unset → ~/OneDrive/ArsTechnicAI when ~/OneDrive
 * exists, otherwise disabled. ARS_ONEDRIVE_DIR=off disables it explicitly.
 */
import { randomBytes } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export interface MirrorAsset {
  assetId: string;
  name: string;
  sha256: string;
  size: number;
  mimeType?: string | null;
  sourcePath: string;
}

export interface ManifestEntry {
  file: string;
  assetId: string;
  sha256: string;
  size: number;
  updatedAt: string;
}

interface Manifest {
  version: 1;
  projectId: string;
  projectName: string;
  updatedAt: string;
  assets: ManifestEntry[];
}

const MANIFEST = '.arstechnicai-manifest.json';
const BUNDLE = 'project.arstechnic.json';

export async function mirrorRoot(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const configured = env.ARS_ONEDRIVE_DIR;
  if (configured && configured.toLowerCase() === 'off') return null;
  if (configured) return path.resolve(configured);
  const oneDrive = path.join(os.homedir(), 'OneDrive');
  try {
    if ((await fs.stat(oneDrive)).isDirectory()) return path.join(oneDrive, 'ArsTechnicAI');
  } catch {
    /* no OneDrive on this machine */
  }
  return null;
}

const MIME_EXT: Record<string, string> = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'audio/mpeg': '.mp3', 'audio/wav': '.wav',
  'text/plain': '.txt', 'application/json': '.json', 'text/markdown': '.md',
};

/** A name that is safe on Linux, macOS and OneDrive (which forbids "*:<>?/\\|). */
export function safeFileName(raw: string, fallback = 'untitled'): string {
  const cleaned = raw
    .normalize('NFC')
    .replace(/[\u0000-\u001f"*:<>?/\\|]/g, '_')
    .replace(/^[\s.~]+/, '') // no leading dot/tilde (hidden or skipped by the client)
    .replace(/[\s.]+$/, '') // OneDrive rejects trailing dots and spaces
    .slice(0, 180)
    .trim();
  return cleaned || fallback;
}

export function projectFolderName(projectName: string, projectId: string): string {
  return `${safeFileName(projectName, 'Untitled project')}-${projectId.slice(0, 8)}`;
}

function withExtension(name: string, mimeType?: string | null): string {
  if (path.extname(name)) return name;
  const ext = mimeType ? MIME_EXT[mimeType.split(';')[0].trim()] : undefined;
  return ext ? name + ext : name;
}

async function atomicWrite(target: string, data: string | Buffer): Promise<void> {
  const tmp = path.join(path.dirname(target), `.~ars-${randomBytes(6).toString('hex')}.tmp`);
  await fs.writeFile(tmp, data, { mode: 0o600 });
  await fs.rename(tmp, target);
}

async function atomicCopy(source: string, target: string): Promise<void> {
  const tmp = path.join(path.dirname(target), `.~ars-${randomBytes(6).toString('hex')}.tmp`);
  await fs.copyFile(source, tmp);
  await fs.chmod(tmp, 0o600).catch(() => {});
  await fs.rename(tmp, target);
}

async function readManifest(dir: string, projectId: string, projectName: string): Promise<Manifest> {
  try {
    const m = JSON.parse(await fs.readFile(path.join(dir, MANIFEST), 'utf-8')) as Manifest;
    if (m.version === 1 && Array.isArray(m.assets)) return m;
  } catch {
    /* new folder */
  }
  return { version: 1, projectId, projectName, updatedAt: new Date().toISOString(), assets: [] };
}

/**
 * Pure name choice, unit-tested. Never returns a name that holds someone else's bytes:
 *  1. an asset keeps the file it already has (new content replaces only its own file;
 *     OneDrive keeps the version history);
 *  2. a new asset takes the desired name if it is free, or if the file there is
 *     already this exact content;
 *  3. otherwise "name (sha8).ext" — and a file the user put there by hand, which is
 *     not in the manifest, is never touched.
 */
export function chooseFileName(desired: string, sha256: string, assetId: string, entries: ManifestEntry[], onDisk: Set<string>): string {
  const own = entries.find((e) => e.assetId === assetId);
  if (own) return own.file;

  const holder = entries.find((e) => e.file === desired);
  if (holder ? holder.sha256 === sha256 : !onDisk.has(desired)) return desired;

  const ext = path.extname(desired);
  const stem = desired.slice(0, desired.length - ext.length);
  const alt = `${stem} (${sha256.slice(0, 8)})${ext}`;
  const altHolder = entries.find((e) => e.file === alt);
  if (altHolder ? altHolder.sha256 === sha256 : !onDisk.has(alt)) return alt;
  return `${stem} (${sha256.slice(0, 8)}-${assetId.slice(0, 8)})${ext}`;
}

export interface MirrorResult {
  ok: boolean;
  dir?: string;
  file?: string;
  skipped?: string;
  error?: string;
}

async function projectDir(root: string, projectId: string, projectName: string): Promise<string> {
  // A renamed project keeps its folder: find the existing "<anything>-<id8>" first.
  const suffix = `-${projectId.slice(0, 8)}`;
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.endsWith(suffix)) {
      try {
        const m = JSON.parse(await fs.readFile(path.join(root, entry.name, MANIFEST), 'utf-8')) as Manifest;
        if (m.projectId === projectId) return path.join(root, entry.name);
      } catch {
        /* not ours */
      }
    }
  }
  const dir = path.join(root, projectFolderName(projectName, projectId));
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export async function mirrorAsset(projectId: string, projectName: string, asset: MirrorAsset): Promise<MirrorResult> {
  try {
    const root = await mirrorRoot();
    if (!root) return { ok: true, skipped: 'mirror disabled' };
    const dir = await projectDir(root, projectId, projectName);
    const manifest = await readManifest(dir, projectId, projectName);
    const onDisk = new Set(await fs.readdir(dir));

    const desired = withExtension(safeFileName(asset.name), asset.mimeType);
    const file = chooseFileName(desired, asset.sha256, asset.assetId, manifest.assets, onDisk);

    const previous = manifest.assets.find((e) => e.assetId === asset.assetId);
    if (!(previous && previous.sha256 === asset.sha256 && previous.file === file && onDisk.has(file))) {
      await atomicCopy(asset.sourcePath, path.join(dir, file));
    }

    const entry: ManifestEntry = { file, assetId: asset.assetId, sha256: asset.sha256, size: asset.size, updatedAt: new Date().toISOString() };
    manifest.assets = [...manifest.assets.filter((e) => e.assetId !== asset.assetId), entry];
    manifest.projectName = projectName;
    manifest.updatedAt = entry.updatedAt;
    await atomicWrite(path.join(dir, MANIFEST), JSON.stringify(manifest, null, 2));
    return { ok: true, dir, file };
  } catch (err) {
    console.warn('[onedrive-mirror] asset mirror failed:', (err as Error).message);
    return { ok: false, error: (err as Error).message };
  }
}

export async function mirrorProjectBundle(projectId: string, projectName: string, bundle: unknown): Promise<MirrorResult> {
  try {
    const root = await mirrorRoot();
    if (!root) return { ok: true, skipped: 'mirror disabled' };
    const dir = await projectDir(root, projectId, projectName);
    const manifest = await readManifest(dir, projectId, projectName);
    await atomicWrite(path.join(dir, BUNDLE), JSON.stringify({ projectId, projectName, mirroredAt: new Date().toISOString(), bundle }));
    manifest.projectName = projectName;
    manifest.updatedAt = new Date().toISOString();
    await atomicWrite(path.join(dir, MANIFEST), JSON.stringify(manifest, null, 2));
    return { ok: true, dir, file: BUNDLE };
  } catch (err) {
    console.warn('[onedrive-mirror] bundle mirror failed:', (err as Error).message);
    return { ok: false, error: (err as Error).message };
  }
}
