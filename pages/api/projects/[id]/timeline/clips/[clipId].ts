import { createApiHandler } from '@/lib/api/handler';
import { ok, noContent } from '@/lib/api/response';
import { updateTimelineClipSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';
import { cacheDel } from '@/lib/redis';

export default createApiHandler(
  { methods: ['PATCH', 'DELETE'] },
  async (req, res) => {
    const projectId = req.query.id as string;
    const clipId = req.query.clipId as string;

    if (req.method === 'PATCH') {
      const data = updateTimelineClipSchema.parse(req.body);
      const clip = await prisma.timelineClip.update({
        where: { id: clipId },
        data,
      });
      await cacheDel(`project:${projectId}:timeline`);
      return ok(res, clip);
    }

    await prisma.timelineClip.delete({ where: { id: clipId } });
    await cacheDel(`project:${projectId}:timeline`);
    return noContent(res);
  }
);
