import { createApiHandler } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET'] },
  async (req, res) => {
    const projectId = req.query.id as string;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        assets: { select: { id: true, name: true, type: true, prompt: true, metadata: true } },
        canvasStates: { include: { items: true, edges: true } },
        timelineStates: { include: { tracks: { include: { clips: true } }, markers: true } },
        fileNodes: true,
        tags: { include: { tag: true } },
        vocabLibraries: true,
      },
    });

    if (!project) throw new NotFoundError('Project');

    res.setHeader('Content-Disposition', `attachment; filename="${project.slug}.json"`);
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(project);
  }
);
