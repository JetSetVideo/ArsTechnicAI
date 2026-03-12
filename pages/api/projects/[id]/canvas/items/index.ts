import { createApiHandler } from '@/lib/api/handler';
import { created } from '@/lib/api/response';
import { canvasItemSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';
import { cacheDel } from '@/lib/redis';

export default createApiHandler(
  { methods: ['POST'], bodySchema: canvasItemSchema },
  async (req, res) => {
    const projectId = req.query.id as string;

    const state = await prisma.canvasState.findFirst({
      where: { projectId, isDefault: true },
    });

    const canvasStateId = state?.id || (await prisma.canvasState.create({
      data: { projectId, name: 'Default', isDefault: true },
    })).id;

    const item = await prisma.canvasItem.create({
      data: { ...req.body, canvasStateId },
    });

    await cacheDel(`project:${projectId}:canvas`);
    return created(res, item);
  }
);
