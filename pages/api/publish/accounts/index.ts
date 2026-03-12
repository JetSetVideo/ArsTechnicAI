import { createApiHandler } from '@/lib/api/handler';
import { ok, created } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

export default createApiHandler(
  { methods: ['GET', 'POST'], role: 'CREATOR' },
  async (req, res) => {
    if (req.method === 'GET') {
      const accounts = await prisma.publishAccount.findMany({
        where: { userId: req.userId },
        select: {
          id: true, platform: true, accountName: true,
          profileUrl: true, isActive: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      return ok(res, accounts);
    }

    // POST - connect account
    const { platform, accountName, accessToken, refreshToken, profileUrl } = req.body;

    const account = await prisma.publishAccount.create({
      data: {
        userId: req.userId,
        platform,
        accountName,
        accessToken: encrypt(accessToken),
        refreshToken: refreshToken ? encrypt(refreshToken) : null,
        profileUrl,
      },
      select: {
        id: true, platform: true, accountName: true,
        profileUrl: true, isActive: true, createdAt: true,
      },
    });

    return created(res, account);
  }
);
