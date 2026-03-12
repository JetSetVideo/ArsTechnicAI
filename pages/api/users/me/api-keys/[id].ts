import { createApiHandler } from '@/lib/api/handler';
import { noContent } from '@/lib/api/response';
import { NotFoundError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['DELETE'], role: 'CREATOR' },
  async (req, res) => {
    const keyId = req.query.id as string;

    const key = await prisma.userApiKey.findFirst({
      where: { id: keyId, userId: req.userId },
    });
    if (!key) throw new NotFoundError('API Key');

    await prisma.userApiKey.delete({ where: { id: keyId } });
    return noContent(res);
  }
);
