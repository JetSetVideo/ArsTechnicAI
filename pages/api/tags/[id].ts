import { createApiHandler } from '@/lib/api/handler';
import { ok, noContent } from '@/lib/api/response';
import { NotFoundError } from '@/lib/api/errors';
import { updateTagSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['PATCH', 'DELETE'], role: 'ADMIN' },
  async (req, res) => {
    const tagId = req.query.id as string;

    if (req.method === 'PATCH') {
      const data = updateTagSchema.parse(req.body);
      const tag = await prisma.tag.update({
        where: { id: tagId },
        data,
      });
      return ok(res, tag);
    }

    // DELETE
    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) throw new NotFoundError('Tag');
    await prisma.tag.delete({ where: { id: tagId } });
    return noContent(res);
  }
);
