import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import { cacheGet, cacheSet, cacheDel } from '@/lib/redis';

export default createApiHandler(
  { methods: ['GET', 'PUT'] },
  async (req, res) => {
    const projectId = req.query.id as string;
    const cacheKey = `project:${projectId}:canvas`;

    if (req.method === 'GET') {
      const cached = await cacheGet(cacheKey);
      if (cached) return ok(res, cached);

      let state = await prisma.canvasState.findFirst({
        where: { projectId, isDefault: true },
        include: {
          items: { orderBy: { zIndex: 'asc' } },
          edges: true,
        },
      });

      if (!state) {
        state = await prisma.canvasState.create({
          data: { projectId, name: 'Default', isDefault: true },
          include: { items: true, edges: true },
        });
      }

      await cacheSet(cacheKey, state, 120);
      return ok(res, state);
    }

    // PUT - full state save
    const { items, edges, viewportX, viewportY, viewportZoom } = req.body;

    let state = await prisma.canvasState.findFirst({
      where: { projectId, isDefault: true },
    });

    if (!state) {
      state = await prisma.canvasState.create({
        data: { projectId, name: 'Default', isDefault: true },
      });
    }

    // Update viewport
    await prisma.canvasState.update({
      where: { id: state.id },
      data: {
        viewportX: viewportX ?? state.viewportX,
        viewportY: viewportY ?? state.viewportY,
        viewportZoom: viewportZoom ?? state.viewportZoom,
      },
    });

    // Replace items if provided
    if (items) {
      await prisma.canvasItem.deleteMany({ where: { canvasStateId: state.id } });
      if (items.length > 0) {
        await prisma.canvasItem.createMany({
          data: items.map((item: Record<string, unknown>) => ({
            ...item,
            canvasStateId: state!.id,
            id: item.id as string || undefined,
          })),
        });
      }
    }

    // Replace edges if provided
    if (edges) {
      await prisma.canvasEdge.deleteMany({ where: { canvasStateId: state.id } });
      if (edges.length > 0) {
        await prisma.canvasEdge.createMany({
          data: edges.map((edge: Record<string, unknown>) => ({
            ...edge,
            canvasStateId: state!.id,
            id: edge.id as string || undefined,
          })),
        });
      }
    }

    await cacheDel(cacheKey);

    const result = await prisma.canvasState.findUnique({
      where: { id: state.id },
      include: { items: { orderBy: { zIndex: 'asc' } }, edges: true },
    });

    return ok(res, result);
  }
);
