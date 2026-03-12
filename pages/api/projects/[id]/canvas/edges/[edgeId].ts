import { createApiHandler } from '@/lib/api/handler';
import { noContent } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import { cacheDel } from '@/lib/redis';

export default createApiHandler(
  { methods: ['DELETE'] },
  async (req, res) => {
    const projectId = req.query.id as string;
    const edgeId = req.query.edgeId as string;

    await prisma.canvasEdge.delete({ where: { id: edgeId } });
    await cacheDel(`project:${projectId}:canvas`);
    return noContent(res);
  }
);
