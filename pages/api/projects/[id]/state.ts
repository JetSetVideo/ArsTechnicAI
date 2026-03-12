import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { withAuth } from '../../../../middleware/authMiddleware';

const prisma = new PrismaClient();

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  _userRoles: string[]
) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Invalid project ID' });
  }

  const project = await prisma.project.findFirst({
    where: { id: id, creatorId: userId },
    select: { id: true },
  });
  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }

  if (req.method === 'GET') {
    const row = await prisma.projectWorkspaceState.findUnique({
      where: { id },
      select: { state: true, updatedAt: true },
    });
    return res.status(200).json({
      state: row?.state ?? null,
      updatedAt: row?.updatedAt ?? null,
    });
  }

  if (req.method === 'PUT') {
    const { state } = req.body as { state?: unknown };
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ message: 'Missing or invalid state payload' });
    }

    const row = await prisma.projectWorkspaceState.upsert({
      where: { id },
      create: { id, state: state as object },
      update: { state: state as object },
      select: { updatedAt: true },
    });
    return res.status(200).json({ ok: true, updatedAt: row.updatedAt });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

export default withAuth(handler);
