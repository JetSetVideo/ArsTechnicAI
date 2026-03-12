import { createApiHandler } from '@/lib/api/handler';
import { ok, noContent } from '@/lib/api/response';
import { NotFoundError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['PATCH', 'DELETE'] },
  async (req, res) => {
    const memberId = req.query.memberId as string;

    if (req.method === 'PATCH') {
      const { role } = req.body;
      const member = await prisma.projectMember.update({
        where: { id: memberId },
        data: { role },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
      return ok(res, member);
    }

    // DELETE
    const member = await prisma.projectMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundError('Member');
    await prisma.projectMember.delete({ where: { id: memberId } });
    return noContent(res);
  }
);
