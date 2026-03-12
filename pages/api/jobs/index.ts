import { createApiHandler } from '@/lib/api/handler';
import { paginated } from '@/lib/api/response';
import { parsePagination } from '@/lib/api/pagination';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export default createApiHandler(
  { methods: ['GET'] },
  async (req, res) => {
    const { skip, take, page, pageSize } = parsePagination(req);
    const { status, type, projectId } = req.query;

    const where: Prisma.GenerationJobWhereInput = { userId: req.userId };
    if (status) where.status = status as Prisma.EnumJobStatusFilter['equals'];
    if (type) where.type = type as Prisma.EnumJobTypeFilter['equals'];
    if (projectId) where.projectId = projectId as string;

    const [jobs, total] = await Promise.all([
      prisma.generationJob.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, type: true, status: true, provider: true, model: true,
          prompt: true, width: true, height: true, progress: true,
          progressMessage: true, error: true, resultAssetId: true,
          createdAt: true, updatedAt: true, completedAt: true,
        },
      }),
      prisma.generationJob.count({ where }),
    ]);

    return paginated(res, jobs, { page, pageSize, total });
  }
);
