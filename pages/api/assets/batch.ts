import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { batchAssetSchema } from '@/lib/validation/schemas';
import { deleteFile } from '@/lib/storage/local';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['POST'], bodySchema: batchAssetSchema, role: 'CREATOR' },
  async (req, res) => {
    const { action, assetIds, projectId, tagId } = req.body;
    let affected = 0;

    switch (action) {
      case 'delete': {
        const assets = await prisma.asset.findMany({
          where: { id: { in: assetIds }, userId: req.userId },
        });
        for (const asset of assets) {
          if (asset.path) await deleteFile(asset.path, 'upload');
          if (asset.thumbnailPath) await deleteFile(asset.thumbnailPath, 'thumbnail');
          if (asset.previewPath) await deleteFile(asset.previewPath, 'preview');
        }
        const result = await prisma.asset.deleteMany({
          where: { id: { in: assetIds }, userId: req.userId },
        });
        affected = result.count;
        break;
      }
      case 'move': {
        if (!projectId) break;
        const result = await prisma.asset.updateMany({
          where: { id: { in: assetIds }, userId: req.userId },
          data: { projectId },
        });
        affected = result.count;
        break;
      }
      case 'tag': {
        if (!tagId) break;
        for (const assetId of assetIds) {
          await prisma.assetTag.upsert({
            where: { assetId_tagId: { assetId, tagId } },
            update: {},
            create: { assetId, tagId },
          });
          affected++;
        }
        break;
      }
      case 'untag': {
        if (!tagId) break;
        const result = await prisma.assetTag.deleteMany({
          where: { assetId: { in: assetIds }, tagId },
        });
        affected = result.count;
        break;
      }
    }

    return ok(res, { action, affected });
  }
);
