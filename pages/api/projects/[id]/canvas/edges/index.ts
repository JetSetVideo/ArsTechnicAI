import { createApiHandler } from '@/lib/api/handler';
import { created } from '@/lib/api/response';
import { canvasEdgeSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';
import { cacheDel } from '@/lib/redis';

export default createApiHandler(
  { methods: ['POST'], bodySchema: canvasEdgeSchema },
  async (req, res) => {
    const projectId = req.query.id as string;

    const state = await prisma.canvasState.findFirstOrThrow({
      where: { projectId, isDefault: true },
    });

    const edge = await prisma.canvasEdge.create({
      data: { ...req.body, canvasStateId: state.id },
    });

    await cacheDel(`project:${projectId}:canvas`);
    return created(res, edge);
  }
);
