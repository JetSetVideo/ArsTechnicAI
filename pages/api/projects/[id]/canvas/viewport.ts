import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { viewportSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';
import { cacheDel } from '@/lib/redis';

export default createApiHandler(
  { methods: ['PUT'], bodySchema: viewportSchema },
  async (req, res) => {
    const projectId = req.query.id as string;
    const { viewportX, viewportY, viewportZoom } = req.body;

    const state = await prisma.canvasState.findFirstOrThrow({
      where: { projectId, isDefault: true },
    });

    const updated = await prisma.canvasState.update({
      where: { id: state.id },
      data: { viewportX, viewportY, viewportZoom },
      select: { id: true, viewportX: true, viewportY: true, viewportZoom: true },
    });

    await cacheDel(`project:${projectId}:canvas`);
    return ok(res, updated);
  }
);
