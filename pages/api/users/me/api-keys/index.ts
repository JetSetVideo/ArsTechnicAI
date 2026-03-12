import { createApiHandler } from '@/lib/api/handler';
import { ok, created } from '@/lib/api/response';
import { createApiKeySchema } from '@/lib/validation/schemas';
import { encrypt } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET', 'POST'], role: 'CREATOR' },
  async (req, res) => {
    if (req.method === 'GET') {
      const keys = await prisma.userApiKey.findMany({
        where: { userId: req.userId },
        select: {
          id: true, provider: true, label: true, isActive: true,
          lastUsedAt: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      return ok(res, keys);
    }

    // POST
    const { provider, key, label } = createApiKeySchema.parse(req.body);
    const encryptedKey = encrypt(key);
    const apiKey = await prisma.userApiKey.create({
      data: {
        userId: req.userId,
        provider,
        encryptedKey,
        label,
      },
      select: { id: true, provider: true, label: true, isActive: true, createdAt: true },
    });
    return created(res, apiKey);
  }
);
