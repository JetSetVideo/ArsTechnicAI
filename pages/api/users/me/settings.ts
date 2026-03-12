import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { userSettingsSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET', 'PUT'] },
  async (req, res) => {
    if (req.method === 'GET') {
      const settings = await prisma.userSettings.findUnique({
        where: { userId: req.userId },
      });
      return ok(res, settings || {});
    }

    // PUT
    const data = userSettingsSchema.parse(req.body);
    const settings = await prisma.userSettings.upsert({
      where: { userId: req.userId },
      update: data,
      create: { userId: req.userId, ...data },
    });
    return ok(res, settings);
  }
);
