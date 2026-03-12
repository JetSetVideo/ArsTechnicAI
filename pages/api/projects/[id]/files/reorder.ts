import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { reorderFileNodesSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['POST'], bodySchema: reorderFileNodesSchema },
  async (req, res) => {
    const { nodes } = req.body;

    await prisma.$transaction(
      nodes.map((n: { id: string; sortOrder: number }) =>
        prisma.fileNode.update({
          where: { id: n.id },
          data: { sortOrder: n.sortOrder },
        })
      )
    );

    return ok(res, { reordered: nodes.length });
  }
);
