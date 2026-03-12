import { createApiHandler } from '@/lib/api/handler';
import { created } from '@/lib/api/response';
import { timelineTrackSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';
import { cacheDel } from '@/lib/redis';

export default createApiHandler(
  { methods: ['POST'], bodySchema: timelineTrackSchema },
  async (req, res) => {
    const projectId = req.query.id as string;

    const state = await prisma.timelineState.findFirstOrThrow({ where: { projectId } });

    const track = await prisma.timelineTrack.create({
      data: { ...req.body, timelineStateId: state.id },
    });

    await cacheDel(`project:${projectId}:timeline`);
    return created(res, track);
  }
);
