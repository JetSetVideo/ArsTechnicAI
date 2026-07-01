import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../middleware/authMiddleware';
import { prisma } from '../../../lib/prisma';

async function handler(req: NextApiRequest, res: NextApiResponse, userId: string, userRoles: string[]) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        pseudonym: true,
        profileImage: true,
        isActive: true,
        isBanned: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.isActive || user.isBanned) {
      return res.status(403).json({ message: 'Account is not active' });
    }

    return res.status(200).json({ user: { ...user, roles: userRoles } });
  } catch (error) {
    console.error('/api/auth/me error:', error);
    return res.status(500).json({ message: 'Failed to fetch user' });
  }
}

export default withAuth(handler);
