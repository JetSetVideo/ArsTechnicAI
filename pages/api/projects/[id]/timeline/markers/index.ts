import { createApiHandler } from '@/lib/api/handler';
import { created } from '@/lib/api/response';
import { timelineMarkerSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';
import { cacheDel } from '@/lib/redis';

export default createApiHandler(
  { methods: ['POST'], bodySchema: timelineMarkerSchema },
  async (req, res) => {
    const projectId = req.query.id as string;

    const state = await prisma.timelineState.findFirstOrThrow({ where: { projectId } });

    const marker = await prisma.timelineMarker.create({
      data: { ...req.body, timelineStateId: state.id },
    });

    await cacheDel(`project:${projectId}:timeline`);
    return created(res, marker);
  }
);
