import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { ValidationError } from '@/lib/api/errors';
import { resetPasswordSchema } from '@/lib/validation/schemas';
import { hashPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['POST'], auth: false, bodySchema: resetPasswordSchema },
  async (req, res) => {
    const { token, password } = req.body;

    const verification = await prisma.verificationToken.findFirst({
      where: { token, expires: { gt: new Date() } },
    });

    if (!verification) {
      throw new ValidationError('Invalid or expired reset token');
    }

    const hashedPassword = await hashPassword(password);

    await prisma.user.update({
      where: { email: verification.identifier },
      data: { hashedPassword },
    });

    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: verification.identifier, token } },
    });

    return ok(res, { message: 'Password reset successfully.' });
  }
);
