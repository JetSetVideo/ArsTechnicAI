import { createApiHandler } from '@/lib/api/handler';
import { ok, created } from '@/lib/api/response';
import { createFileNodeSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET', 'POST'] },
  async (req, res) => {
    const projectId = req.query.id as string;

    if (req.method === 'GET') {
      const nodes = await prisma.fileNode.findMany({
        where: { projectId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          asset: {
            select: { id: true, name: true, type: true, thumbnailPath: true, mimeType: true },
          },
        },
      });
      return ok(res, nodes);
    }

    // POST
    const data = createFileNodeSchema.parse(req.body);
    const maxOrder = await prisma.fileNode.aggregate({
      where: { projectId, parentId: data.parentId || null },
      _max: { sortOrder: true },
    });

    const node = await prisma.fileNode.create({
      data: {
        ...data,
        projectId,
        path: data.name,
        sortOrder: (maxOrder._max.sortOrder || 0) + 1,
      },
    });
    return created(res, node);
  }
);
