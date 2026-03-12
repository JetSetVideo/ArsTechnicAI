import { createApiHandler } from '@/lib/api/handler';
import { ok, noContent } from '@/lib/api/response';
import { NotFoundError, ForbiddenError } from '@/lib/api/errors';
import { updateProjectSchema } from '@/lib/validation/schemas';
import { isOwnerOrRole } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET', 'PATCH', 'DELETE'] },
  async (req, res) => {
    const projectId = req.query.id as string;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { assets: true, members: true, canvasStates: true, timelineStates: true } },
      },
    });

    if (!project) throw new NotFoundError('Project');

    // Access check
    if (!project.isPublic && !isOwnerOrRole(req.userId, project.ownerId, req.userRole, 'ADMIN')) {
      const isMember = await prisma.projectMember.findFirst({
        where: { projectId, userId: req.userId },
      });
      if (!isMember) throw new ForbiddenError();
    }

    if (req.method === 'GET') {
      return ok(res, project);
    }

    // Write operations require ownership or ADMIN
    if (!isOwnerOrRole(req.userId, project.ownerId, req.userRole, 'ADMIN')) {
      throw new ForbiddenError();
    }

    if (req.method === 'PATCH') {
      const data = updateProjectSchema.parse(req.body);
      const updated = await prisma.project.update({
        where: { id: projectId },
        data: { ...data, version: { increment: 1 } },
      });
      return ok(res, updated);
    }

    // DELETE
    await prisma.project.delete({ where: { id: projectId } });
    return noContent(res);
  }
);
