import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../middleware/authMiddleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function handler(
  req: NextApiRequest, 
  res: NextApiResponse, 
  userId: string, 
  userRoles: string[]
) {
  try {
    switch (req.method) {
      case 'GET':
        // Fetch user profile
        const profile = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            email: true,
            profileImage: true,
            bio: true,
            createdAt: true,
            projects: {
              select: {
                id: true,
                name: true,
                description: true,
                createdAt: true
              }
            }
          }
        });

        return res.status(200).json(profile);

      case 'PUT':
        // Update user profile
        const { username, bio, profileImage } = req.body;

        const updatedProfile = await prisma.user.update({
          where: { id: userId },
          data: {
            ...(username && { username }),
            ...(bio && { bio }),
            ...(profileImage && { profileImage })
          },
          select: {
            id: true,
            username: true,
            email: true,
            profileImage: true,
            bio: true
          }
        });

        return res.status(200).json(updatedProfile);

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Profile management error:', error);
    return res.status(500).json({ 
      message: error instanceof Error ? error.message : 'Profile management failed' 
    });
  }
}

export default withAuth(handler);