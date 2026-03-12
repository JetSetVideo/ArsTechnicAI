import { createApiHandler } from '@/lib/api/handler';
import { ok, noContent } from '@/lib/api/response';
import { updateTimelineTrackSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';
import { cacheDel } from '@/lib/redis';

export default createApiHandler(
  { methods: ['PATCH', 'DELETE'] },
  async (req, res) => {
    const projectId = req.query.id as string;
    const trackId = req.query.trackId as string;

    if (req.method === 'PATCH') {
      const data = updateTimelineTrackSchema.parse(req.body);
      const track = await prisma.timelineTrack.update({
        where: { id: trackId },
        data,
      });
      await cacheDel(`project:${projectId}:timeline`);
      return ok(res, track);
    }

    await prisma.timelineTrack.delete({ where: { id: trackId } });
    await cacheDel(`project:${projectId}:timeline`);
    return noContent(res);
  }
);
