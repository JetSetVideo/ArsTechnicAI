import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../middleware/authMiddleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  try {
    switch (req.method) {
      case 'GET': {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            pseudonym: true,
            profileImage: true,
            bio: true,
            createdAt: true,
          },
        });

        if (!user) return res.status(404).json({ message: 'User not found' });
        return res.status(200).json(user);
      }

      case 'PUT': {
        const { pseudonym, firstName, lastName, bio, profileImage } = req.body;

        // Validate pseudonym uniqueness if being changed
        if (pseudonym !== undefined) {
          const trimmed = pseudonym.trim();
          if (trimmed.length < 2) {
            return res.status(400).json({ message: 'Pseudonym must be at least 2 characters' });
          }
          if (trimmed.length > 30) {
            return res.status(400).json({ message: 'Pseudonym must be 30 characters or fewer' });
          }
          const taken = await prisma.user.findFirst({
            where: { pseudonym: trimmed, NOT: { id: userId } },
          });
          if (taken) {
            return res.status(409).json({ message: 'This pseudonym is already taken' });
          }
        }

        const updated = await prisma.user.update({
          where: { id: userId },
          data: {
            ...(pseudonym !== undefined && { pseudonym: pseudonym.trim() }),
            ...(firstName !== undefined && { firstName: firstName.trim() }),
            ...(lastName !== undefined && { lastName: lastName.trim() }),
            ...(bio !== undefined && { bio }),
            ...(profileImage !== undefined && { profileImage }),
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            pseudonym: true,
            profileImage: true,
            bio: true,
          },
        });

        return res.status(200).json(updated);
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Profile error:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Profile operation failed',
    });
  }
}

export default withAuth(handler);
