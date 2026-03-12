import { createApiHandler } from '@/lib/api/handler';
import { paginated } from '@/lib/api/response';
import { parsePagination } from '@/lib/api/pagination';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET'], role: 'ADMIN' },
  async (req, res) => {
    const { skip, take, page, pageSize } = parsePagination(req);
    const { userId, type } = req.query;

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (type) where.type = type;

    const [logs, total] = await Promise.all([
      prisma.actionLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.actionLog.count({ where }),
    ]);

    return paginated(res, logs, { page, pageSize, total });
  }
);
