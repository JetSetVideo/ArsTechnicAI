import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { NotFoundError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET'] },
  async (req, res) => {
    const id = req.query.id as string;

    const job = await prisma.publishJob.findUnique({
      where: { id },
      include: {
        publishAccount: {
          select: { platform: true, accountName: true },
        },
      },
    });
    if (!job) throw new NotFoundError('PublishJob');

    return ok(res, job);
  }
);
