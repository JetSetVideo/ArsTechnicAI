import { createApiHandler } from '@/lib/api/handler';
import { ok, noContent } from '@/lib/api/response';
import { NotFoundError } from '@/lib/api/errors';
import { updateAssetSchema } from '@/lib/validation/schemas';
import { isOwnerOrRole } from '@/lib/auth/permissions';
import { deleteFile } from '@/lib/storage/local';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET', 'PATCH', 'DELETE'] },
  async (req, res) => {
    const assetId = req.query.id as string;

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { tags: { include: { tag: true } } },
    });
    if (!asset) throw new NotFoundError('Asset');

    if (req.method === 'GET') {
      return ok(res, asset);
    }

    if (!isOwnerOrRole(req.userId, asset.userId, req.userRole, 'ADMIN')) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    }

    if (req.method === 'PATCH') {
      const data = updateAssetSchema.parse(req.body);
      const updated = await prisma.asset.update({
        where: { id: assetId },
        data,
        include: { tags: { include: { tag: true } } },
      });
      return ok(res, updated);
    }

    // DELETE
    if (asset.path) await deleteFile(asset.path, 'upload');
    if (asset.thumbnailPath) await deleteFile(asset.thumbnailPath, 'thumbnail');
    if (asset.previewPath) await deleteFile(asset.previewPath, 'preview');
    await prisma.asset.delete({ where: { id: assetId } });
    return noContent(res);
  }
);
