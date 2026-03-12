import { createApiHandler } from '@/lib/api/handler';
import { ok, created, paginated } from '@/lib/api/response';
import { parsePagination } from '@/lib/api/pagination';
import { createProjectSchema } from '@/lib/validation/schemas';
import { generateSlug } from '@/lib/utils/slug';
import { hasRole } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET', 'POST'] },
  async (req, res) => {
    if (req.method === 'GET') {
      const { skip, take, page, pageSize } = parsePagination(req);
      const isAdmin = hasRole(req.userRole, 'ADMIN');

      const where = isAdmin
        ? {}
        : {
            OR: [
              { ownerId: req.userId },
              { isPublic: true },
              { members: { some: { userId: req.userId } } },
            ],
          };

      const [projects, total] = await Promise.all([
        prisma.project.findMany({
          where,
          skip,
          take,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true, name: true, slug: true, description: true,
            isPublic: true, isArchived: true, currentMode: true,
            thumbnailUrl: true, createdAt: true, updatedAt: true,
            owner: { select: { id: true, name: true, avatarUrl: true } },
            _count: { select: { assets: true, members: true } },
          },
        }),
        prisma.project.count({ where }),
      ]);

      return paginated(res, projects, { page, pageSize, total });
    }

    // POST - requires CREATOR+
    if (!hasRole(req.userRole, 'CREATOR')) {
      return res.status(403).json({ success: false, error: { message: 'CREATOR role required' } });
    }

    const data = createProjectSchema.parse(req.body);
    const slug = generateSlug(data.name);

    const project = await prisma.project.create({
      data: {
        ...data,
        slug,
        ownerId: req.userId,
      },
      select: {
        id: true, name: true, slug: true, description: true,
        isPublic: true, currentMode: true, createdAt: true,
      },
    });

    return created(res, project);
  }
);
