/**
 * Server side of device sync (Ubuntu = home server; Mac / this machine's UI = clients).
 *
 * Built only on tables that exist in the database (prisma/schema.prisma):
 *   Project                — one row per synced project, owned by its creator
 *   ProjectWorkspaceState  — the bundle (lib/sync/bundle.ts), versioned by updatedAt
 *   ProjectAsset           — one row per synced file; path = "blob:<sha256>"
 *
 * Concurrency: a push names the server version it was based on. The write is a
 * compare-and-swap on that version (updateMany … where updatedAt = base), so two
 * devices racing can never silently overwrite each other — the loser gets the
 * server copy back as a 409 and the client keeps both.
 *
 * Nothing here deletes: removed projects/assets simply stop being pushed.
 */
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { bundleDigestInput, isStoredState, SYNC_FORMAT, type StoredState, type SyncBundle } from '@/lib/sync/bundle';
import { mirrorProjectBundle } from '@/lib/storage/oneDriveMirror';

export function hashBundle(bundle: SyncBundle): string {
  return createHash('sha256').update(bundleDigestInput(bundle)).digest('hex');
}

export interface ManifestAsset {
  assetId: string;
  name: string;
  sha256: string | null;
  size: number | null;
  mimeType: string | null;
  updatedAt: number;
}

export interface ManifestProject {
  id: string;
  name: string;
  description: string | null;
  updatedAt: number;
  /** null when the project has never had a bundle pushed. */
  version: number | null;
  hash: string | null;
  device: string | null;
  assets: ManifestAsset[];
}

function assetSha(metadata: Prisma.JsonValue | null): { sha256: string | null; size: number | null } {
  const m = (metadata ?? {}) as Record<string, unknown>;
  return {
    sha256: typeof m.sha256 === 'string' ? m.sha256 : null,
    size: typeof m.size === 'number' ? m.size : null,
  };
}

export async function getManifest(userId: string): Promise<ManifestProject[]> {
  const projects = await prisma.project.findMany({
    where: { creatorId: userId },
    include: {
      workspaceState: true,
      assets: { select: { assetId: true, name: true, mimeType: true, metadata: true, updatedAt: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  return projects.map((p) => {
    const st = p.workspaceState?.state;
    const stored = isStoredState(st) ? st : null;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      updatedAt: p.updatedAt.getTime(),
      version: p.workspaceState ? p.workspaceState.updatedAt.getTime() : null,
      hash: stored?.hash ?? null,
      device: stored?.device ?? null,
      assets: p.assets.map((a) => ({ assetId: a.assetId, name: a.name, mimeType: a.mimeType, updatedAt: a.updatedAt.getTime(), ...assetSha(a.metadata) })),
    };
  });
}

export class SyncError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = 'SyncError';
  }
}

/** The project, if `userId` may write it; creates nothing. */
export async function ownedProject(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project && project.creatorId !== userId) throw new SyncError('This project belongs to another account', 403, 'FORBIDDEN');
  return project;
}

export interface PushInput {
  projectId: string;
  name: string;
  description?: string | null;
  bundle: SyncBundle;
  /** Server version this push was based on; null for a first push. */
  baseVersion: number | null;
  device?: string;
}

export type PushResult =
  | { status: 'created' | 'updated' | 'unchanged'; version: number; hash: string }
  | { status: 'conflict'; server: { version: number; hash: string | null; name: string; bundle: SyncBundle | null; device: string | null } };

async function conflictOf(projectId: string): Promise<PushResult> {
  const p = await prisma.project.findUnique({ where: { id: projectId }, include: { workspaceState: true } });
  const st = p?.workspaceState?.state;
  const stored = isStoredState(st) ? st : null;
  return {
    status: 'conflict',
    server: {
      version: p?.workspaceState?.updatedAt.getTime() ?? 0,
      hash: stored?.hash ?? null,
      name: p?.name ?? '',
      bundle: stored?.bundle ?? null,
      device: stored?.device ?? null,
    },
  };
}

export async function pushProject(userId: string, input: PushInput): Promise<PushResult> {
  const hash = hashBundle(input.bundle);
  const name = input.name.trim().slice(0, 200) || 'Untitled';
  const state: StoredState = { format: SYNC_FORMAT, hash, bundle: input.bundle, device: input.device?.slice(0, 80), pushedAt: new Date().toISOString() };

  const project = await ownedProject(userId, input.projectId);
  if (!project) {
    await prisma.project.create({ data: { id: input.projectId, name, description: input.description ?? null, creatorId: userId } });
  } else if (project.name !== name || (input.description !== undefined && project.description !== input.description)) {
    await prisma.project.update({ where: { id: input.projectId }, data: { name, ...(input.description !== undefined ? { description: input.description } : {}) } });
  }

  const current = await prisma.projectWorkspaceState.findUnique({ where: { projectId: input.projectId } });

  if (!current) {
    try {
      const created = await prisma.projectWorkspaceState.create({ data: { projectId: input.projectId, state: state as unknown as Prisma.InputJsonValue } });
      void mirrorProjectBundle(input.projectId, name, input.bundle);
      return { status: 'created', version: created.updatedAt.getTime(), hash };
    } catch (err) {
      // Another device created it between our read and write.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return conflictOf(input.projectId);
      throw err;
    }
  }

  const currentHash = isStoredState(current.state) ? current.state.hash : null;
  if (currentHash === hash) return { status: 'unchanged', version: current.updatedAt.getTime(), hash };
  if (input.baseVersion !== current.updatedAt.getTime()) return conflictOf(input.projectId);

  const swapped = await prisma.projectWorkspaceState.updateMany({
    // Version AND content must still be what we read — two writes in the same
    // millisecond would share a version, but never a hash.
    where: {
      projectId: input.projectId,
      updatedAt: current.updatedAt,
      ...(currentHash ? { state: { path: ['hash'], equals: currentHash } } : {}),
    },
    data: { state: state as unknown as Prisma.InputJsonValue },
  });
  if (swapped.count !== 1) return conflictOf(input.projectId);

  const after = await prisma.projectWorkspaceState.findUniqueOrThrow({ where: { projectId: input.projectId } });
  void mirrorProjectBundle(input.projectId, name, input.bundle);
  return { status: 'updated', version: after.updatedAt.getTime(), hash };
}

export async function pullProject(userId: string, projectId: string) {
  const project = await ownedProject(userId, projectId);
  if (!project) throw new SyncError('Project not found', 404, 'NOT_FOUND');
  const ws = await prisma.projectWorkspaceState.findUnique({ where: { projectId } });
  const stored = ws && isStoredState(ws.state) ? ws.state : null;
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    version: ws ? ws.updatedAt.getTime() : null,
    hash: stored?.hash ?? null,
    device: stored?.device ?? null,
    bundle: stored?.bundle ?? null,
  };
}

export async function recordAsset(
  userId: string,
  projectId: string,
  asset: { assetId: string; name: string; mimeType: string | null; sha256: string; size: number; metadata?: Record<string, unknown> }
) {
  const project = await ownedProject(userId, projectId);
  if (!project) throw new SyncError('Push the project before its assets', 404, 'PROJECT_NOT_FOUND');
  const metadata = { ...(asset.metadata ?? {}), sha256: asset.sha256, size: asset.size, storage: 'blob' } as Prisma.InputJsonValue;
  const row = await prisma.projectAsset.upsert({
    where: { projectId_assetId: { projectId, assetId: asset.assetId } },
    create: { projectId, assetId: asset.assetId, name: asset.name, path: `blob:${asset.sha256}`, mimeType: asset.mimeType, metadata },
    update: { name: asset.name, path: `blob:${asset.sha256}`, mimeType: asset.mimeType, metadata },
  });
  return { project, row };
}

export async function findAsset(userId: string, projectId: string, assetId: string) {
  const project = await ownedProject(userId, projectId);
  if (!project) return null;
  const row = await prisma.projectAsset.findUnique({ where: { projectId_assetId: { projectId, assetId } } });
  if (!row) return null;
  return { project, row, ...assetSha(row.metadata) };
}
