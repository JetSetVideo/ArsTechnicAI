import { createApiHandler } from '@/lib/api/handler';
import { ok, noContent } from '@/lib/api/response';
import { NotFoundError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET', 'DELETE'] },
  async (req, res) => {
    const jobId = req.query.id as string;

    const job = await prisma.generationJob.findFirst({
      where: { id: jobId, userId: req.userId },
      include: {
        resultAsset: {
          select: { id: true, name: true, thumbnailPath: true, path: true },
        },
      },
    });

    if (!job) throw new NotFoundError('Job');

    if (req.method === 'GET') return ok(res, job);

    // DELETE
    await prisma.generationJob.delete({ where: { id: jobId } });
    return noContent(res);
  }
);
