import { createApiHandler } from '@/lib/api/handler';
import { ok, created } from '@/lib/api/response';
import { vocabLibrarySchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET', 'POST'] },
  async (req, res) => {
    if (req.method === 'GET') {
      const { category, projectId } = req.query;
      const where: Record<string, unknown> = {};
      if (category) where.category = category;
      if (projectId) {
        where.OR = [{ projectId }, { isGlobal: true }];
      }

      const libraries = await prisma.vocabLibrary.findMany({
        where,
        orderBy: { name: 'asc' },
      });
      return ok(res, libraries);
    }

    // POST
    const data = vocabLibrarySchema.parse(req.body);
    const library = await prisma.vocabLibrary.create({ data });
    return created(res, library);
  }
);
