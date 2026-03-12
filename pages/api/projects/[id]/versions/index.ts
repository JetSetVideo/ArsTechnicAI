import { createApiHandler } from '@/lib/api/handler';
import { ok, created, paginated } from '@/lib/api/response';
import { NotFoundError, ForbiddenError } from '@/lib/api/errors';
import { parsePagination } from '@/lib/api/pagination';
import { createVersionSchema } from '@/lib/validation/schemas';
import { isOwnerOrRole } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET', 'POST'] },
  async (req, res) => {
    const projectId = req.query.id as string;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundError('Project');

    if (!isOwnerOrRole(req.userId, project.ownerId, req.userRole, 'ADMIN')) {
      const isMember = await prisma.projectMember.findFirst({
        where: { projectId, userId: req.userId },
      });
      if (!isMember) throw new ForbiddenError();
    }

    if (req.method === 'GET') {
      const { skip, take, page, pageSize } = parsePagination(req);
      const [versions, total] = await Promise.all([
        prisma.projectVersion.findMany({
          where: { projectId },
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            version: true,
            label: true,
            trigger: true,
            createdBy: true,
            createdAt: true,
          },
        }),
        prisma.projectVersion.count({ where: { projectId } }),
      ]);
      return paginated(res, versions, { page, pageSize, total });
    }

    // POST — create snapshot
    if (!isOwnerOrRole(req.userId, project.ownerId, req.userRole, 'ADMIN')) {
      throw new ForbiddenError();
    }

    const { label, trigger } = createVersionSchema.parse(req.body);

    // Fetch current state to snapshot
    const [canvasState, timelineState, fileNodes] = await Promise.all([
      prisma.canvasState.findFirst({
        where: { projectId, isDefault: true },
        include: { items: true, edges: true },
      }),
      prisma.timelineState.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
        include: {
          tracks: { include: { clips: true } },
          markers: true,
        },
      }),
      prisma.fileNode.findMany({ where: { projectId } }),
    ]);

    const snapshot = {
      canvas: canvasState
        ? {
            viewportX: canvasState.viewportX,
            viewportY: canvasState.viewportY,
            viewportZoom: canvasState.viewportZoom,
            items: canvasState.items,
            edges: canvasState.edges,
          }
        : null,
      timeline: timelineState
        ? {
            duration: timelineState.duration,
            fps: timelineState.fps,
            width: timelineState.width,
            height: timelineState.height,
            tracks: timelineState.tracks,
            markers: timelineState.markers,
          }
        : null,
      fileNodes,
    };

    // Increment project version and store snapshot atomically
    const [version] = await prisma.$transaction([
      prisma.projectVersion.create({
        data: {
          projectId,
          version: project.version,
          label,
          trigger,
          snapshot,
          createdBy: req.userId,
        },
      }),
      prisma.project.update({
        where: { id: projectId },
        data: { version: { increment: 1 } },
      }),
    ]);

    return created(res, {
      id: version.id,
      version: version.version,
      label: version.label,
      trigger: version.trigger,
      createdAt: version.createdAt,
    });
  }
);
