import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { forgotPasswordSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export default createApiHandler(
  { methods: ['POST'], auth: false, bodySchema: forgotPasswordSchema },
  async (req, res) => {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 3600000); // 1 hour

      await prisma.verificationToken.create({
        data: { identifier: email, token, expires },
      });

      // TODO: Send email with reset link containing token
      console.log(`Password reset token for ${email}: ${token}`);
    }

    // Always return success to prevent email enumeration
    return ok(res, { message: 'If that email exists, a reset link has been sent.' });
  }
);
