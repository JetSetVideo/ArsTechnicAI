import { createApiHandler } from '@/lib/api/handler';
import { created } from '@/lib/api/response';
import { timelineClipSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';
import { cacheDel } from '@/lib/redis';

export default createApiHandler(
  { methods: ['POST'], bodySchema: timelineClipSchema },
  async (req, res) => {
    const projectId = req.query.id as string;

    const clip = await prisma.timelineClip.create({
      data: req.body,
    });

    await cacheDel(`project:${projectId}:timeline`);
    return created(res, clip);
  }
);
