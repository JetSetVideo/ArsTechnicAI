import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { updateProfileSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET', 'PATCH'] },
  async (req, res) => {
    if (req.method === 'GET') {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: req.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          displayName: true,
          bio: true,
          avatarUrl: true,
          timezone: true,
          locale: true,
          totalLogins: true,
          lastLoginAt: true,
          lastLoginIp: true,
          totalMinutesOnline: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { projects: true, assets: true },
          },
          devices: {
            where: { isRevoked: false },
            orderBy: { lastSeenAt: 'desc' },
            take: 5,
            select: {
              id: true,
              name: true,
              browser: true,
              os: true,
              deviceType: true,
              city: true,
              country: true,
              countryCode: true,
              lastSeenAt: true,
              loginCount: true,
              isTrusted: true,
              createdAt: true,
            },
          },
          userSessions: {
            orderBy: { startedAt: 'desc' },
            take: 5,
            select: {
              id: true,
              startedAt: true,
              endedAt: true,
              durationMs: true,
              device: { select: { name: true, browser: true, os: true } },
            },
          },
        },
      });
      return ok(res, user);
    }

    // PATCH
    const data = updateProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        timezone: true,
        locale: true,
      },
    });
    return ok(res, user);
  }
);
