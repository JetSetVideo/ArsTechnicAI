import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { withAuth } from '../../../../middleware/authMiddleware';

const prisma = new PrismaClient();

interface AssetPayloadInput {
  assetId: string;
  name: string;
  path: string;
  mimeType?: string;
  width?: number;
  height?: number;
  payloadDataUrl?: string;
  metadata?: Record<string, unknown>;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  _userRoles: string[]
) {
  const { projectId } = req.query;
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ message: 'Invalid project ID' });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, creatorId: userId },
    select: { id: true },
  });
  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }

  if (req.method === 'GET') {
    const assets = await prisma.projectAsset.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    });
    return res.status(200).json({ assets });
  }

  if (req.method === 'PUT') {
    const { assets } = req.body as { assets?: AssetPayloadInput[] };
    if (!Array.isArray(assets)) {
      return res.status(400).json({ message: 'assets must be an array' });
    }

    const upserted = await Promise.all(
      assets
        .filter((asset) => asset?.assetId && asset?.name && asset?.path)
        .map((asset) =>
          prisma.projectAsset.upsert({
            where: {
              projectId_assetId: {
                projectId,
                assetId: asset.assetId,
              },
            },
            create: {
              projectId,
              assetId: asset.assetId,
              name: asset.name,
              path: asset.path,
              mimeType: asset.mimeType,
              width: typeof asset.width === 'number' ? asset.width : null,
              height: typeof asset.height === 'number' ? asset.height : null,
              payloadDataUrl: asset.payloadDataUrl || null,
              metadata: asset.metadata || null,
            },
            update: {
              name: asset.name,
              path: asset.path,
              mimeType: asset.mimeType,
              width: typeof asset.width === 'number' ? asset.width : null,
              height: typeof asset.height === 'number' ? asset.height : null,
              payloadDataUrl: asset.payloadDataUrl || null,
              metadata: asset.metadata || null,
            },
          })
        )
    );

    return res.status(200).json({ ok: true, count: upserted.length });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

export default withAuth(handler);
