import { createApiHandler } from '@/lib/api/handler';
import { ok, created } from '@/lib/api/response';
import { promptTemplateSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET', 'POST'] },
  async (req, res) => {
    if (req.method === 'GET') {
      const { category } = req.query;
      const templates = await prisma.promptTemplate.findMany({
        where: category ? { category: category as string } : {},
        orderBy: { name: 'asc' },
      });
      return ok(res, templates);
    }

    // POST
    const data = promptTemplateSchema.parse(req.body);
    const template = await prisma.promptTemplate.create({ data });
    return created(res, template);
  }
);
