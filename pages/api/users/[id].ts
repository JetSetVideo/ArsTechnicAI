import { createApiHandler } from '@/lib/api/handler';
import { ok, noContent } from '@/lib/api/response';
import { NotFoundError } from '@/lib/api/errors';
import { updateUserSchema } from '@/lib/validation/schemas';
import { hasRole } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET', 'PATCH', 'DELETE'], role: 'ADMIN' },
  async (req, res) => {
    const userId = req.query.id as string;

    if (req.method === 'GET') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, name: true, email: true, role: true, isActive: true,
          displayName: true, bio: true, avatarUrl: true, timezone: true,
          locale: true, createdAt: true, updatedAt: true,
          _count: { select: { projects: true, assets: true, generationJobs: true } },
        },
      });
      if (!user) throw new NotFoundError('User');
      return ok(res, user);
    }

    if (req.method === 'PATCH') {
      const data = updateUserSchema.parse(req.body);
      const user = await prisma.user.update({
        where: { id: userId },
        data,
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });
      return ok(res, user);
    }

    // DELETE - SUPERADMIN only
    if (!hasRole(req.userRole, 'SUPERADMIN')) {
      return res.status(403).json({ success: false, error: { message: 'Only SUPERADMIN can delete users' } });
    }
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
    return noContent(res);
  }
);
