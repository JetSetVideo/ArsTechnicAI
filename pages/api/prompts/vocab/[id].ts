import { createApiHandler } from '@/lib/api/handler';
import { ok, noContent } from '@/lib/api/response';
import { NotFoundError } from '@/lib/api/errors';
import { vocabLibrarySchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET', 'PATCH', 'DELETE'] },
  async (req, res) => {
    const id = req.query.id as string;

    if (req.method === 'GET') {
      const lib = await prisma.vocabLibrary.findUnique({ where: { id } });
      if (!lib) throw new NotFoundError('VocabLibrary');
      return ok(res, lib);
    }

    if (req.method === 'PATCH') {
      const data = vocabLibrarySchema.partial().parse(req.body);
      const lib = await prisma.vocabLibrary.update({ where: { id }, data });
      return ok(res, lib);
    }

    await prisma.vocabLibrary.delete({ where: { id } });
    return noContent(res);
  }
);
