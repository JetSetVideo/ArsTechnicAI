import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { canvasBatchSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';
import { cacheDel } from '@/lib/redis';

export default createApiHandler(
  { methods: ['POST'], bodySchema: canvasBatchSchema },
  async (req, res) => {
    const projectId = req.query.id as string;
    const { updates } = req.body;

    await prisma.$transaction(
      updates.map((u: { id: string; data: Record<string, unknown> }) =>
        prisma.canvasItem.update({
          where: { id: u.id },
          data: u.data,
        })
      )
    );

    await cacheDel(`project:${projectId}:canvas`);
    return ok(res, { updated: updates.length });
  }
);
