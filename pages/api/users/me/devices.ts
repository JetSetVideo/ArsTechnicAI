import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET'] },
  async (req, res) => {
    const devices = await prisma.userDevice.findMany({
      where: { userId: req.userId, isRevoked: false },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        name: true,
        browser: true,
        os: true,
        deviceType: true,
        ip: true,
        city: true,
        country: true,
        countryCode: true,
        timezone: true,
        loginCount: true,
        lastSeenAt: true,
        createdAt: true,
        isTrusted: true,
      },
    });
    return ok(res, devices);
  }
);
