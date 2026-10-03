/**
 * Device sync engine — runs in the browser on every machine (Mac, Ubuntu UI).
 *
 * Home server: NEXT_PUBLIC_API_URL (e.g. http://192.168.1.55:3002), or this
 * origin when unset (the Ubuntu UI syncing its own disk with its own database).
 *
 *   local  = this machine's projects: projects store + .ars-data via /api/workspace/*
 *   server = /api/sync/* on the home server (services/sync/syncService)
 *   index  = what both sides agreed on at the last sync, per project
 *            (localStorage, per server origin + account)
 *
 * Per project:
 *   only local                      → push (create)
 *   only on server                  → pull
 *   same content hash               → in sync
 *   changed here only               → push (compare-and-swap on the agreed version)
 *   changed there only              → pull
 *   changed on both / CAS lost (409) → CONFLICT: the server version stays under the
 *       original id, the local version is kept as "<name> (conflict copy · <device> · <date>)"
 *       and pushed too. Nothing is ever overwritten or deleted.
 *   currently open in an editor     → deferred (an open editor's autosave would
 *       overwrite a pulled copy and silently undo the other device's edits)
 *
 * Files under /generated/ referenced by a project's file tree follow by hash.
 */
import { useAuthStore } from '@/stores/authStore';
import { useProjectsStore } from '@/stores/projectsStore';
import { useProjectStore } from '@/stores/projectStore';
import { usePipelineStore, pipelineStorageKey } from '@/stores/pipelineStore';
import { useSyncStore, type SyncConflict, type SyncReport } from '@/stores/syncStore';
import { canvasStateKey } from '@/hooks/useProjectSync';
import { saveToDisk } from '@/hooks/useDiskSave';
import { assetRefsOf, bundleDigestInput, type BundleAssetRef, type SyncBundle } from './bundle';
import { digestHex } from './sha256';
import type { DashboardProject } from '@/types/dashboard';

// ── Types mirrored from the server ───────────────────────────────────────────

interface ManifestAsset { assetId: string; name: string; sha256: string | null; size: number | null; mimeType: string | null; updatedAt: number }
interface ManifestProject { id: string; name: string; description: string | null; updatedAt: number; version: number | null; hash: string | null; device: string | null; assets: ManifestAsset[] }

interface IndexEntry { version: number; hash: string; assets: Record<string, string> }
interface SyncIndex { server: string; userId: string; projects: Record<string, IndexEntry> }

const INDEX_KEY = 'ars:sync-index';
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

// ── Small helpers ────────────────────────────────────────────────────────────

export function homeServer(): string {
  return (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
}

function serverKey(): string {
  return homeServer() || window.location.origin;
}

export function deviceName(): string {
  try {
    const custom = localStorage.getItem('ars:device-name');
    if (custom) return custom.slice(0, 40);
  } catch { /* ignore */ }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Ubuntu';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Browser';
}

export async function hashBundleClient(bundle: SyncBundle): Promise<string> {
  return digestHex(bundleDigestInput(bundle));
}

class OfflineError extends Error {}
class SignedOutError extends Error {}

async function remote(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = useAuthStore.getState().getAuthHeader();
  const headers = new Headers(init.headers);
  if (auth.Authorization) headers.set('Authorization', auth.Authorization);
  let res: Response;
  try {
    res = await fetch(`${homeServer()}${path}`, { ...init, headers });
  } catch {
    // In a browser a CORS rejection fails exactly like a dead network. Ask the
    // server something that needs no preflight before calling it "offline".
    let reachable = false;
    try {
      reachable = (await fetch(`${homeServer()}/api/health`, { cache: 'no-store' })).status > 0;
    } catch { /* really unreachable */ }
    if (reachable) throw new Error(`Request to ${path.split('?')[0]} was blocked (CORS or network policy) — check CORS_ALLOWED_ORIGINS on the home server`);
    throw new OfflineError('Home server unreachable');
  }
  if (res.status === 401) throw new SignedOutError('Sign in to the home server to sync');
  return res;
}

function loadIndex(userId: string): SyncIndex {
  const fresh: SyncIndex = { server: serverKey(), userId, projects: {} };
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return fresh;
    const idx = JSON.parse(raw) as SyncIndex;
    // A different server or account starts from scratch — never mix their histories.
    return idx.server === fresh.server && idx.userId === userId ? idx : fresh;
  } catch {
    return fresh;
  }
}

function saveIndex(idx: SyncIndex) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
  } catch { /* quota — next run re-derives from hashes */ }
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', wav: 'audio/wav',
  txt: 'text/plain', md: 'text/markdown', json: 'application/json',
};

function mimeOf(file: string): string {
  return MIME_BY_EXT[file.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

function b64url(json: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(json));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Local side ───────────────────────────────────────────────────────────────

async function loadLocalBundle(projectId: string): Promise<SyncBundle> {
  const res = await fetch(`/api/workspace/load?projectId=${encodeURIComponent(projectId)}`);
  if (!res.ok) throw new Error(`Local load failed for ${projectId} (${res.status})`);
  const data = (await res.json()) as { canvas?: unknown; pipeline?: unknown; fileState?: unknown };
  const bundle: SyncBundle = {};
  if (data.canvas) bundle.canvas = data.canvas;
  if (data.pipeline) bundle.pipeline = data.pipeline;
  if (data.fileState) bundle.fileState = data.fileState;
  // The pipeline editor writes localStorage synchronously and disk without
  // awaiting — the cache is never older than disk, so prefer it.
  try {
    const cached = localStorage.getItem(pipelineStorageKey(projectId));
    if (cached) {
      const parsed = JSON.parse(cached) as { nodes?: unknown };
      if (parsed && Array.isArray(parsed.nodes)) bundle.pipeline = parsed;
    }
  } catch { /* corrupt cache — disk copy stands */ }
  return bundle;
}

function isEmptyBundle(b: SyncBundle): boolean {
  return !b.canvas && !b.pipeline && !b.fileState;
}

async function saveLocalBundle(projectId: string, projectName: string, bundle: SyncBundle): Promise<void> {
  const canvas = bundle.canvas as { viewport?: unknown; items?: unknown } | undefined;
  const res = await fetch('/api/workspace/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      projectName,
      ...(canvas ? { canvas: { viewport: canvas.viewport, items: canvas.items ?? [] } } : {}),
      ...(bundle.pipeline ? { pipeline: bundle.pipeline } : {}),
      ...(bundle.fileState ? { fileState: bundle.fileState } : {}),
      // settings are never synced — API keys stay on the machine that holds them
    }),
  });
  if (!res.ok) throw new Error(`Local save failed for ${projectId} (${res.status})`);
  // The editors prefer their localStorage cache over disk; drop it so the next
  // open loads what was just written.
  try {
    localStorage.removeItem(canvasStateKey(projectId));
    localStorage.removeItem(pipelineStorageKey(projectId));
  } catch { /* ignore */ }
}

function upsertLocalProject(id: string, name: string, modifiedAt: number, description?: string | null) {
  const store = useProjectsStore.getState();
  const existing = store.projects.find((p) => p.id === id);
  if (existing) {
    store.updateProject(id, { name, modifiedAt, ...(description ? { description } : {}) });
    return;
  }
  const project: DashboardProject = { id, name, createdAt: modifiedAt, modifiedAt, assetCount: 0, tags: [], ...(description ? { description } : {}) };
  useProjectsStore.setState((s) => ({ projects: [...s.projects, project] }));
}

function openProjectIds(): Set<string> {
  const ids = new Set<string>();
  const canvasId = useProjectStore.getState().projectId;
  const pipelineId = usePipelineStore.getState().currentProjectId;
  if (canvasId) ids.add(canvasId);
  if (pipelineId) ids.add(pipelineId);
  return ids;
}

async function localFileBytes(file: string): Promise<Uint8Array | null> {
  const res = await fetch(`/api/sync/local-file?name=${encodeURIComponent(file)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Local file read failed: ${file} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

async function localFileExists(file: string): Promise<boolean> {
  const res = await fetch(`/api/sync/local-file?name=${encodeURIComponent(file)}`, { method: 'HEAD' });
  return res.ok;
}

// ── One run ──────────────────────────────────────────────────────────────────

let running: Promise<SyncReport | null> | null = null;

/** Sync now. Concurrent calls share the run in progress. */
export function syncNow(opts: { allowOpen?: string[] } = {}): Promise<SyncReport | null> {
  if (running) return running.then(() => syncNow(opts));
  const run = async () => {
    const withLock = (navigator as Navigator & { locks?: { request: (n: string, cb: () => Promise<SyncReport | null>) => Promise<SyncReport | null> } }).locks;
    const go = () => runOnce(new Set(opts.allowOpen ?? []));
    return withLock ? withLock.request('ars-sync', go) : go();
  };
  running = run().finally(() => { running = null; });
  return running;
}

async function runOnce(allowOpen: Set<string> = new Set()): Promise<SyncReport | null> {
  const sync = useSyncStore.getState();
  const auth = useAuthStore.getState();
  if (!auth.isSessionValid() || !auth.user) {
    sync.setStatus('signed-out', 'Sign in to the home server to sync');
    return null;
  }

  const report: SyncReport = { startedAt: Date.now(), finishedAt: 0, pushed: [], pulled: [], conflicts: [], deferred: [], assetsUp: 0, assetsDown: 0, errors: [] };
  sync.setStatus('syncing');

  try {
    await saveToDisk().catch(() => false); // flush the open project before reading disk

    const manifestRes = await remote('/api/sync/manifest');
    if (!manifestRes.ok) throw new Error(`Manifest failed (${manifestRes.status})`);
    const manifest = (await manifestRes.json()) as { projects: ManifestProject[] };

    const server = new Map(manifest.projects.map((p) => [p.id, p]));
    const shaOnServer = new Set(manifest.projects.flatMap((p) => p.assets.map((a) => a.sha256).filter(Boolean) as string[]));
    const local = new Map(useProjectsStore.getState().projects.filter((p) => SAFE_ID.test(p.id)).map((p) => [p.id, p]));
    const open = openProjectIds();
    for (const id of allowOpen) open.delete(id);
    const idx = loadIndex(auth.user.id);
    const device = deviceName();

    const ids = new Set([...local.keys(), ...server.keys()]);
    for (const id of ids) {
      try {
        await syncProject(id, local.get(id), server.get(id), { idx, server, open, device, report, shaOnServer });
      } catch (err) {
        if (err instanceof OfflineError || err instanceof SignedOutError) throw err;
        report.errors.push(`${local.get(id)?.name ?? server.get(id)?.name ?? id}: ${(err as Error).message}`);
      }
      saveIndex(idx);
    }

    report.finishedAt = Date.now();
    useSyncStore.getState().finish(report);
    return report;
  } catch (err) {
    if (err instanceof OfflineError) sync.setStatus('offline', err.message);
    else if (err instanceof SignedOutError) sync.setStatus('signed-out', err.message);
    else sync.setStatus('error', (err as Error).message);
    return null;
  }
}

interface Ctx {
  idx: SyncIndex;
  /** The server's view at the start of the run, by project id. */
  server: Map<string, ManifestProject>;
  open: Set<string>;
  device: string;
  report: SyncReport;
  shaOnServer: Set<string>;
}

async function syncProject(id: string, localProjectIn: DashboardProject | undefined, serverProject: ManifestProject | undefined, ctx: Ctx) {
  let localProject = localProjectIn;
  const { idx, open, report } = ctx;
  const known = idx.projects[id];

  if (!localProject && serverProject) {
    if (serverProject.version === null) return;
    if (open.has(id)) return void report.deferred.push({ id, name: serverProject.name });
    // Not in this browser's project list does not mean not on this machine: the
    // list lives in localStorage (cleared data, another browser) while the
    // project's files are on disk. Never pull over content found there.
    const onDisk = await loadLocalBundle(id);
    if (isEmptyBundle(onDisk)) {
      await pull(id, ctx);
      return;
    }
    upsertLocalProject(id, serverProject.name, Date.now(), serverProject.description);
    localProject = useProjectsStore.getState().projects.find((p) => p.id === id);
    if (!localProject) return;
  }
  if (!localProject) return;

  const bundle = await loadLocalBundle(id);
  const localHash = await hashBundleClient(bundle);

  // An empty local copy (never saved here, or its files are gone) must never be
  // pushed over real content on the server — take the server's instead.
  if (isEmptyBundle(bundle) && serverProject?.hash) {
    if (open.has(id)) return void report.deferred.push({ id, name: localProject.name });
    await pull(id, ctx);
    return;
  }

  if (!serverProject || serverProject.version === null) {
    await push(id, localProject, bundle, localHash, null, ctx);
    return;
  }

  if (serverProject.hash === localHash) {
    idx.projects[id] = { version: serverProject.version, hash: localHash, assets: known?.assets ?? {} };
    await syncAssets(id, bundle, serverProject, ctx);
    return;
  }

  const localChanged = !known || known.hash !== localHash;
  const remoteChanged = !known || known.version !== serverProject.version;

  if (localChanged && !remoteChanged) {
    await push(id, localProject, bundle, localHash, known!.version, ctx);
  } else if (!localChanged && remoteChanged) {
    if (open.has(id)) return void report.deferred.push({ id, name: localProject.name });
    await pull(id, ctx);
  } else {
    await keepBoth(id, localProject, bundle, serverProject, ctx);
  }
}

async function push(id: string, project: DashboardProject, bundle: SyncBundle, hash: string, baseVersion: number | null, ctx: Ctx) {
  const res = await remote(`/api/sync/projects/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: project.name, description: project.description ?? null, bundle, baseVersion, device: ctx.device }),
  });
  if (res.status === 409) {
    const body = (await res.json()) as { server: { version: number; hash: string | null; name: string; device: string | null } };
    const entry: ManifestProject = { id, name: body.server.name, description: null, updatedAt: body.server.version, version: body.server.version, hash: body.server.hash, device: body.server.device, assets: [] };
    await keepBoth(id, project, bundle, entry, ctx);
    return;
  }
  if (!res.ok) throw new Error(`Push failed (${res.status})`);
  const out = (await res.json()) as { status: string; version: number; hash: string };
  ctx.idx.projects[id] = { version: out.version, hash: out.hash, assets: ctx.idx.projects[id]?.assets ?? {} };
  if (out.status !== 'unchanged') ctx.report.pushed.push(project.name);

  // Assets the server already has for this project: skip them instead of re-linking.
  const manifestEntry: ManifestProject = { id, name: project.name, description: null, updatedAt: out.version, version: out.version, hash: out.hash, device: ctx.device, assets: ctx.server.get(id)?.assets ?? [] };
  await uploadAssets(id, bundle, manifestEntry, ctx);
}

async function pull(id: string, ctx: Ctx, opts: { localAlreadyKept?: boolean } = {}) {
  const res = await remote(`/api/sync/projects/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Pull failed (${res.status})`);
  const p = (await res.json()) as { name: string; description: string | null; version: number | null; hash: string | null; bundle: SyncBundle | null };
  if (!p.bundle || p.version === null || !p.hash) return;

  // Invariant: never overwrite local content that is neither the server's version
  // nor the version both sides last agreed on — that content exists nowhere else.
  if (!opts.localAlreadyKept) {
    const local = await loadLocalBundle(id);
    if (!isEmptyBundle(local)) {
      const h = await hashBundleClient(local);
      if (h !== p.hash && h !== ctx.idx.projects[id]?.hash) {
        const name = useProjectsStore.getState().projects.find((x) => x.id === id)?.name ?? p.name;
        const entry: ManifestProject = { id, name: p.name, description: p.description, updatedAt: p.version, version: p.version, hash: p.hash, device: null, assets: [] };
        await keepBoth(id, { id, name, createdAt: Date.now(), modifiedAt: Date.now(), assetCount: 0, tags: [] }, local, entry, ctx);
        return;
      }
    }
  }

  await saveLocalBundle(id, p.name, p.bundle);
  upsertLocalProject(id, p.name, p.version, p.description);
  ctx.idx.projects[id] = { version: p.version, hash: p.hash, assets: ctx.idx.projects[id]?.assets ?? {} };
  ctx.report.pulled.push(p.name);
  await downloadAssets(id, p.bundle, ctx);
}

/** Never lose either side: server version under the original id, local version as a copy. */
async function keepBoth(id: string, project: DashboardProject, localBundle: SyncBundle, serverProject: ManifestProject, ctx: Ctx) {
  if (ctx.open.has(id)) return void ctx.report.deferred.push({ id, name: project.name });

  const copyId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const copyName = `${project.name} (conflict copy · ${ctx.device} · ${stamp})`;

  // 1. Keep the local version first, under its own id, before anything is replaced.
  await saveLocalBundle(copyId, copyName, localBundle);
  upsertLocalProject(copyId, copyName, Date.now(), project.description);

  // 2. Take the server version under the original id (the local one is safe in the copy).
  await pull(id, ctx, { localAlreadyKept: true });

  // 3. Share the copy so the other devices see both.
  const copy: DashboardProject = { ...project, id: copyId, name: copyName };
  await push(copyId, copy, localBundle, await hashBundleClient(localBundle), null, ctx);

  const conflict: SyncConflict = { projectId: id, name: project.name, copyId, copyName, serverDevice: serverProject.device, at: Date.now() };
  ctx.report.conflicts.push(conflict);
}

// ── Assets ───────────────────────────────────────────────────────────────────

async function syncAssets(id: string, bundle: SyncBundle, serverProject: ManifestProject, ctx: Ctx) {
  await uploadAssets(id, bundle, serverProject, ctx);
  await downloadAssets(id, bundle, ctx, serverProject);
}

function fileOf(ref: BundleAssetRef): string {
  return ref.urlPath.replace(/^\/generated\//, '');
}

async function uploadAssets(id: string, bundle: SyncBundle, serverProject: ManifestProject, ctx: Ctx) {
  const entry = ctx.idx.projects[id];
  const onServer = new Map(serverProject.assets.map((a) => [a.assetId, a.sha256]));
  for (const ref of assetRefsOf(bundle)) {
    if (entry?.assets[ref.assetId] && onServer.get(ref.assetId) === entry.assets[ref.assetId]) continue;
    const bytes = await localFileBytes(fileOf(ref));
    if (!bytes) continue; // referenced but not on this machine
    const sha = await digestHex(bytes);
    if (onServer.get(ref.assetId) === sha) {
      if (entry) entry.assets[ref.assetId] = sha;
      continue;
    }
    const headers: Record<string, string> = {
      'Content-Type': mimeOf(fileOf(ref)),
      'X-Ars-Sha256': sha,
      'X-Ars-Name': encodeURIComponent(fileOf(ref)),
    };
    if (ref.metadata) {
      const meta = b64url(ref.metadata);
      if (meta.length < 10_000) headers['X-Ars-Metadata'] = meta;
    }
    let res: Response;
    if (ctx.shaOnServer.has(sha)) {
      res = await remote(`/api/sync/assets/${encodeURIComponent(id)}/${encodeURIComponent(ref.assetId)}`, { method: 'PUT', headers: { ...headers, 'X-Ars-Reuse': '1' }, body: new Uint8Array(0) });
      if (res.status === 412) res = await remote(`/api/sync/assets/${encodeURIComponent(id)}/${encodeURIComponent(ref.assetId)}`, { method: 'PUT', headers, body: bytes as BodyInit });
    } else {
      res = await remote(`/api/sync/assets/${encodeURIComponent(id)}/${encodeURIComponent(ref.assetId)}`, { method: 'PUT', headers, body: bytes as BodyInit });
    }
    if (!res.ok) throw new Error(`Upload of ${fileOf(ref)} failed (${res.status})`);
    ctx.shaOnServer.add(sha);
    if (ctx.idx.projects[id]) ctx.idx.projects[id].assets[ref.assetId] = sha;
    ctx.report.assetsUp++;
  }
}

async function downloadAssets(id: string, bundle: SyncBundle, ctx: Ctx, serverProject?: ManifestProject) {
  const entry = ctx.idx.projects[id];
  const shas = new Map((serverProject?.assets ?? []).map((a) => [a.assetId, a.sha256]));
  for (const ref of assetRefsOf(bundle)) {
    if (entry?.assets[ref.assetId]) continue;
    const file = fileOf(ref);
    if (await localFileExists(file)) continue;
    const res = await remote(`/api/sync/assets/${encodeURIComponent(id)}/${encodeURIComponent(ref.assetId)}`);
    if (res.status === 404) continue; // the other device has not uploaded it (yet)
    if (!res.ok) throw new Error(`Download of ${file} failed (${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const sha = await digestHex(bytes);
    const declared = res.headers.get('X-Ars-Sha256') ?? shas.get(ref.assetId);
    if (declared && declared !== sha) throw new Error(`Download of ${file} was corrupted in transit`);
    const put = await fetch(`/api/sync/local-file?name=${encodeURIComponent(file)}`, { method: 'PUT', headers: { 'X-Ars-Sha256': sha }, body: bytes as BodyInit });
    if (!put.ok && put.status !== 409) throw new Error(`Saving ${file} locally failed (${put.status})`);
    if (entry) entry.assets[ref.assetId] = sha;
    ctx.report.assetsDown++;
  }
}

// ── Taking another device's changes into the open project ────────────────────

/**
 * The user asked for it (the "Load latest" action): flush what is in the
 * editors, sync this one project even though it is open — unsynced local work is
 * kept as a conflict copy first — then reload the editors from disk so their
 * autosave cannot write the old in-memory state back.
 */
export async function loadLatest(projectId: string): Promise<SyncReport | null> {
  const pipeline = usePipelineStore.getState();
  if (pipeline.currentProjectId === projectId) pipeline.saveForProject(projectId, pipeline.currentProjectName);
  const report = await syncNow({ allowOpen: [projectId] });

  const name = useProjectsStore.getState().projects.find((p) => p.id === projectId)?.name ?? '';
  if (usePipelineStore.getState().currentProjectId === projectId) {
    await usePipelineStore.getState().loadForProject(projectId, name);
  }
  if (useProjectStore.getState().projectId === projectId) {
    const { loadProjectWorkspaceState } = await import('@/hooks/useProjectSync');
    await loadProjectWorkspaceState(projectId, name);
  }
  return report;
}
