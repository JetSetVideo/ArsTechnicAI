import { createApiHandler } from '@/lib/api/handler';
import { ok, created } from '@/lib/api/response';
import { addMemberSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET', 'POST'] },
  async (req, res) => {
    const projectId = req.query.id as string;

    if (req.method === 'GET') {
      const members = await prisma.projectMember.findMany({
        where: { projectId },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { joinedAt: 'asc' },
      });
      return ok(res, members);
    }

    // POST
    const { userId, role } = addMemberSchema.parse(req.body);
    const member = await prisma.projectMember.create({
      data: { projectId, userId, role: role || 'USER' },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
    return created(res, member);
  }
);
