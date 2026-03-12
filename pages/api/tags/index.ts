import { createApiHandler } from '@/lib/api/handler';
import { ok, created } from '@/lib/api/response';
import { createTagSchema } from '@/lib/validation/schemas';
import { hasRole } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET', 'POST'] },
  async (req, res) => {
    if (req.method === 'GET') {
      const tags = await prisma.tag.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { assets: true } } },
      });
      return ok(res, tags);
    }

    // POST - CREATOR+
    if (!hasRole(req.userRole, 'CREATOR')) {
      return res.status(403).json({ success: false, error: { message: 'CREATOR role required' } });
    }

    const data = createTagSchema.parse(req.body);
    const tag = await prisma.tag.create({
      data: { ...data, createdBy: req.userId },
    });
    return created(res, tag);
  }
);
