import { createApiHandler } from '@/lib/api/handler';
import { created } from '@/lib/api/response';
import { ValidationError } from '@/lib/api/errors';
import { generateSlug } from '@/lib/utils/slug';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['POST'], role: 'CREATOR' },
  async (req, res) => {
    const data = req.body;
    if (!data?.name) throw new ValidationError('Invalid project data');

    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        slug: generateSlug(data.name),
        ownerId: req.userId,
        currentMode: data.currentMode || 'CREATE',
        layoutState: data.layoutState,
      },
    });

    return created(res, project);
  }
);
