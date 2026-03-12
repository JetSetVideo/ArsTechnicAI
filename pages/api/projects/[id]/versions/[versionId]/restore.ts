import { createApiHandler } from '@/lib/api/handler';
import { created } from '@/lib/api/response';
import { NotFoundError, ForbiddenError } from '@/lib/api/errors';
import { isOwnerOrRole } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

interface SnapshotCanvas {
  viewportX?: number;
  viewportY?: number;
  viewportZoom?: number;
  items?: Record<string, unknown>[];
  edges?: Record<string, unknown>[];
}

interface SnapshotTimeline {
  tracks?: (Record<string, unknown> & { clips?: Record<string, unknown>[] })[];
  markers?: Record<string, unknown>[];
}

interface SnapshotFileNode {
  id: string;
  parentId?: string | null;
  [key: string]: unknown;
}

interface Snapshot {
  canvas?: SnapshotCanvas | null;
  timeline?: SnapshotTimeline | null;
  fileNodes?: SnapshotFileNode[];
}

function sortByDepth(nodes: SnapshotFileNode[]): SnapshotFileNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const sorted: SnapshotFileNode[] = [];

  function visit(node: SnapshotFileNode) {
    if (visited.has(node.id)) return;
    if (node.parentId && byId.has(node.parentId)) visit(byId.get(node.parentId)!);
    visited.add(node.id);
    sorted.push(node);
  }

  nodes.forEach(visit);
  return sorted;
}

export default createApiHandler(
  { methods: ['POST'] },
  async (req, res) => {
    const projectId = req.query.id as string;
    const versionId = req.query.versionId as string;

    const [project, version] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId } }),
      prisma.projectVersion.findFirst({ where: { id: versionId, projectId } }),
    ]);

    if (!project) throw new NotFoundError('Project');
    if (!version) throw new NotFoundError('Version');

    if (!isOwnerOrRole(req.userId, project.ownerId, req.userRole, 'ADMIN')) {
      throw new ForbiddenError();
    }

    const snap = version.snapshot as Snapshot;

    const [canvasState, timelineState] = await Promise.all([
      prisma.canvasState.findFirst({ where: { projectId, isDefault: true } }),
      prisma.timelineState.findFirst({ where: { projectId }, orderBy: { createdAt: 'asc' } }),
    ]);

    await prisma.$transaction(async (tx) => {
      // ── Canvas restore ──────────────────────────────────────
      if (canvasState && snap.canvas) {
        await tx.canvasState.update({
          where: { id: canvasState.id },
          data: {
            viewportX: snap.canvas.viewportX ?? 0,
            viewportY: snap.canvas.viewportY ?? 0,
            viewportZoom: snap.canvas.viewportZoom ?? 1,
          },
        });

        await tx.canvasItem.deleteMany({ where: { canvasStateId: canvasState.id } });
        await tx.canvasEdge.deleteMany({ where: { canvasStateId: canvasState.id } });

        // Resolve which asset IDs still exist
        const rawAssetIds = (snap.canvas.items ?? [])
          .map((i) => i['assetId'])
          .filter((id): id is string => typeof id === 'string');
        const validAssets = rawAssetIds.length
          ? new Set(
              (
                await tx.asset.findMany({ where: { id: { in: rawAssetIds } }, select: { id: true } })
              ).map((a) => a.id)
            )
          : new Set<string>();

        const itemIdMap = new Map<string, string>();
        for (const item of snap.canvas.items ?? []) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id: oldId, canvasStateId: _cs, createdAt: _ca, updatedAt: _ua, assetId: rawAsset, ...rest } = item;
          const assetId =
            typeof rawAsset === 'string' && validAssets.has(rawAsset) ? rawAsset : null;
          const created = await tx.canvasItem.create({
            data: { ...(rest as Prisma.CanvasItemCreateInput), assetId, canvasStateId: canvasState.id },
          });
          if (typeof oldId === 'string') itemIdMap.set(oldId, created.id);
        }

        for (const edge of snap.canvas.edges ?? []) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id: _id, canvasStateId: _cs, createdAt: _ca, sourceItemId, targetItemId, ...rest } = edge;
          const newSourceId = typeof sourceItemId === 'string' ? itemIdMap.get(sourceItemId) : undefined;
          const newTargetId = typeof targetItemId === 'string' ? itemIdMap.get(targetItemId) : undefined;
          if (newSourceId && newTargetId) {
            await tx.canvasEdge.create({
              data: {
                ...(rest as Prisma.CanvasEdgeCreateInput),
                canvasStateId: canvasState.id,
                sourceItemId: newSourceId,
                targetItemId: newTargetId,
              },
            });
          }
        }
      }

      // ── Timeline restore ────────────────────────────────────
      if (timelineState && snap.timeline) {
        await tx.timelineTrack.deleteMany({ where: { timelineStateId: timelineState.id } });
        await tx.timelineMarker.deleteMany({ where: { timelineStateId: timelineState.id } });

        for (const track of snap.timeline.tracks ?? []) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id: _id, timelineStateId: _ts, clips, createdAt: _ca, updatedAt: _ua, ...trackData } = track;
          const createdTrack = await tx.timelineTrack.create({
            data: { ...(trackData as Prisma.TimelineTrackCreateInput), timelineStateId: timelineState.id },
          });

          for (const clip of clips ?? []) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id: _cid, trackId: _tid, createdAt: _cca, updatedAt: _cua, ...clipData } = clip;
            await tx.timelineClip.create({
              data: { ...(clipData as Prisma.TimelineClipCreateInput), trackId: createdTrack.id },
            });
          }
        }

        for (const marker of snap.timeline.markers ?? []) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id: _mid, timelineStateId: _ts, createdAt: _ca, ...markerData } = marker;
          await tx.timelineMarker.create({
            data: { ...(markerData as Prisma.TimelineMarkerCreateInput), timelineStateId: timelineState.id },
          });
        }
      }

      // ── File nodes restore ──────────────────────────────────
      if (snap.fileNodes && snap.fileNodes.length > 0) {
        await tx.fileNode.deleteMany({ where: { projectId } });
        const sorted = sortByDepth(snap.fileNodes);
        const nodeIdMap = new Map<string, string>();

        for (const node of sorted) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id: oldId, projectId: _pid, parentId: oldParentId, createdAt: _ca, updatedAt: _ua, ...nodeData } = node;
          const newParentId = oldParentId ? (nodeIdMap.get(oldParentId) ?? null) : null;
          const created = await tx.fileNode.create({
            data: { ...(nodeData as Prisma.FileNodeCreateInput), projectId, parentId: newParentId },
          });
          nodeIdMap.set(oldId, created.id);
        }
      }

      // ── Record restore as new version ───────────────────────
      await tx.projectVersion.create({
        data: {
          projectId,
          version: project.version,
          label: `Restored from v${version.version}`,
          trigger: 'RESTORE',
          snapshot: snap as Prisma.InputJsonValue,
          createdBy: req.userId,
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: { version: { increment: 1 } },
      });
    });

    return created(res, { projectId, restoredFrom: version.version });
  }
);
