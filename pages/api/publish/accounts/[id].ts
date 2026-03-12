import { createApiHandler } from '@/lib/api/handler';
import { noContent } from '@/lib/api/response';
import { NotFoundError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['DELETE'], role: 'CREATOR' },
  async (req, res) => {
    const id = req.query.id as string;

    const account = await prisma.publishAccount.findFirst({
      where: { id, userId: req.userId },
    });
    if (!account) throw new NotFoundError('PublishAccount');

    await prisma.publishAccount.delete({ where: { id } });
    return noContent(res);
  }
);
