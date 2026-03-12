import { createApiHandler } from '@/lib/api/handler';
import { created } from '@/lib/api/response';
import { NotFoundError } from '@/lib/api/errors';
import { generateSlug } from '@/lib/utils/slug';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['POST'], role: 'CREATOR' },
  async (req, res) => {
    const projectId = req.query.id as string;

    const source = await prisma.project.findUnique({
      where: { id: projectId },
      include: { tags: true },
    });
    if (!source) throw new NotFoundError('Project');

    const project = await prisma.project.create({
      data: {
        name: `${source.name} (copy)`,
        description: source.description,
        slug: generateSlug(`${source.name} copy`),
        ownerId: req.userId,
        isPublic: false,
        currentMode: source.currentMode,
        layoutState: source.layoutState,
      },
    });

    return created(res, project);
  }
);
