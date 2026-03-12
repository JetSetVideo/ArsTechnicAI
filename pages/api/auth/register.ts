import { createApiHandler } from '@/lib/api/handler';
import { created } from '@/lib/api/response';
import { ConflictError } from '@/lib/api/errors';
import { registerSchema } from '@/lib/validation/schemas';
import { hashPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['POST'], auth: false, bodySchema: registerSchema },
  async (req, res) => {
    const { name, email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictError('Email already registered');

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        hashedPassword,
        role: 'USER',
        settings: { create: {} },
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    return created(res, user);
  }
);
