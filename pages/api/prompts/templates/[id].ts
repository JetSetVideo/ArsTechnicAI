import { createApiHandler } from '@/lib/api/handler';
import { ok, noContent } from '@/lib/api/response';
import { NotFoundError } from '@/lib/api/errors';
import { promptTemplateSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET', 'PATCH', 'DELETE'] },
  async (req, res) => {
    const id = req.query.id as string;

    if (req.method === 'GET') {
      const template = await prisma.promptTemplate.findUnique({ where: { id } });
      if (!template) throw new NotFoundError('Template');
      return ok(res, template);
    }

    if (req.method === 'PATCH') {
      const data = promptTemplateSchema.partial().parse(req.body);
      const template = await prisma.promptTemplate.update({ where: { id }, data });
      return ok(res, template);
    }

    // DELETE
    await prisma.promptTemplate.delete({ where: { id } });
    return noContent(res);
  }
);
