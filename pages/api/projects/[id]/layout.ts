import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { layoutStateSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['PUT'], bodySchema: layoutStateSchema },
  async (req, res) => {
    const projectId = req.query.id as string;
    const { layoutState } = req.body;

    const project = await prisma.project.update({
      where: { id: projectId },
      data: { layoutState },
      select: { id: true, layoutState: true },
    });

    return ok(res, project);
  }
);
