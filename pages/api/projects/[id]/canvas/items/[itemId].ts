import { createApiHandler } from '@/lib/api/handler';
import { ok, noContent } from '@/lib/api/response';
import { updateCanvasItemSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';
import { cacheDel } from '@/lib/redis';

export default createApiHandler(
  { methods: ['PATCH', 'DELETE'] },
  async (req, res) => {
    const projectId = req.query.id as string;
    const itemId = req.query.itemId as string;

    if (req.method === 'PATCH') {
      const data = updateCanvasItemSchema.parse(req.body);
      const item = await prisma.canvasItem.update({
        where: { id: itemId },
        data,
      });
      await cacheDel(`project:${projectId}:canvas`);
      return ok(res, item);
    }

    await prisma.canvasItem.delete({ where: { id: itemId } });
    await cacheDel(`project:${projectId}:canvas`);
    return noContent(res);
  }
);
