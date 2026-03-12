import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import { cacheGet, cacheSet, cacheDel } from '@/lib/redis';

export default createApiHandler(
  { methods: ['GET', 'PUT'] },
  async (req, res) => {
    const projectId = req.query.id as string;
    const cacheKey = `project:${projectId}:timeline`;

    if (req.method === 'GET') {
      const cached = await cacheGet(cacheKey);
      if (cached) return ok(res, cached);

      let state = await prisma.timelineState.findFirst({
        where: { projectId },
        include: {
          tracks: {
            orderBy: { sortOrder: 'asc' },
            include: { clips: { orderBy: { startTime: 'asc' } } },
          },
          markers: { orderBy: { time: 'asc' } },
        },
      });

      if (!state) {
        state = await prisma.timelineState.create({
          data: { projectId, name: 'Default' },
          include: { tracks: { include: { clips: true } }, markers: true },
        });
      }

      await cacheSet(cacheKey, state, 120);
      return ok(res, state);
    }

    // PUT - full state save
    const { duration, fps, width, height } = req.body;

    let state = await prisma.timelineState.findFirst({ where: { projectId } });
    if (!state) {
      state = await prisma.timelineState.create({
        data: { projectId, name: 'Default' },
      });
    }

    const updated = await prisma.timelineState.update({
      where: { id: state.id },
      data: {
        duration: duration ?? state.duration,
        fps: fps ?? state.fps,
        width: width ?? state.width,
        height: height ?? state.height,
      },
      include: {
        tracks: { orderBy: { sortOrder: 'asc' }, include: { clips: true } },
        markers: { orderBy: { time: 'asc' } },
      },
    });

    await cacheDel(cacheKey);
    return ok(res, updated);
  }
);
