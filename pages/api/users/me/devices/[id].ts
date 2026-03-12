import { createApiHandler } from '@/lib/api/handler';
import { ok, noContent } from '@/lib/api/response';
import { NotFoundError } from '@/lib/api/errors';
import { updateDeviceSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['PATCH', 'DELETE'] },
  async (req, res) => {
    const deviceId = req.query.id as string;

    const device = await prisma.userDevice.findFirst({
      where: { id: deviceId, userId: req.userId },
    });
    if (!device) throw new NotFoundError('Device');

    if (req.method === 'PATCH') {
      const { name } = updateDeviceSchema.parse(req.body);
      const updated = await prisma.userDevice.update({
        where: { id: deviceId },
        data: { name },
        select: { id: true, name: true, browser: true, os: true, lastSeenAt: true },
      });
      return ok(res, updated);
    }

    // DELETE — revoke device
    await prisma.userDevice.update({
      where: { id: deviceId },
      data: { isRevoked: true },
    });
    return noContent(res);
  }
);
