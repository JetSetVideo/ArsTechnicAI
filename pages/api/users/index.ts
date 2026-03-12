import { createApiHandler } from '@/lib/api/handler';
import { paginated } from '@/lib/api/response';
import { parsePagination } from '@/lib/api/pagination';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET'], role: 'ADMIN' },
  async (req, res) => {
    const { skip, take, page, pageSize } = parsePagination(req);
    const where = req.query.search
      ? {
          OR: [
            { name: { contains: req.query.search as string, mode: 'insensitive' as const } },
            { email: { contains: req.query.search as string, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, role: true, isActive: true,
          displayName: true, avatarUrl: true, createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return paginated(res, users, { page, pageSize, total });
  }
);
