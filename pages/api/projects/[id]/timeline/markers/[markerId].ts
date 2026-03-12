import { createApiHandler } from '@/lib/api/handler';
import { noContent } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import { cacheDel } from '@/lib/redis';

export default createApiHandler(
  { methods: ['DELETE'] },
  async (req, res) => {
    const projectId = req.query.id as string;
    const markerId = req.query.markerId as string;

    await prisma.timelineMarker.delete({ where: { id: markerId } });
    await cacheDel(`project:${projectId}:timeline`);
    return noContent(res);
  }
);
