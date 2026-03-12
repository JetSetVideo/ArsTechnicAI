import { createApiHandler } from '@/lib/api/handler';
import { ok, created, paginated } from '@/lib/api/response';
import { parsePagination } from '@/lib/api/pagination';
import { createAssetSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export default createApiHandler(
  { methods: ['GET', 'POST'] },
  async (req, res) => {
    if (req.method === 'GET') {
      const { skip, take, page, pageSize } = parsePagination(req);
      const { projectId, type, status } = req.query;

      const where: Prisma.AssetWhereInput = { userId: req.userId };
      if (projectId) where.projectId = projectId as string;
      if (type) where.type = type as Prisma.EnumAssetTypeFilter['equals'];
      if (status) where.status = status as Prisma.EnumMediaStatusFilter['equals'];

      const [assets, total] = await Promise.all([
        prisma.asset.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, name: true, type: true, status: true, mimeType: true,
            size: true, width: true, height: true, duration: true,
            thumbnailPath: true, prompt: true, provider: true, model: true,
            projectId: true, createdAt: true, updatedAt: true,
            tags: { include: { tag: true } },
          },
        }),
        prisma.asset.count({ where }),
      ]);

      return paginated(res, assets, { page, pageSize, total });
    }

    // POST - create asset record (without file upload)
    const data = createAssetSchema.parse(req.body);
    const asset = await prisma.asset.create({
      data: {
        ...data,
        userId: req.userId,
      },
    });

    return created(res, asset);
  }
);
