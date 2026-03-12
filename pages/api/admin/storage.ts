import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

async function getDirSize(dirPath: string): Promise<number> {
  try {
    const entries = await fs.readdir(dirPath, { recursive: true, withFileTypes: true } as any);
    let size = 0;
    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = path.join(entry.parentPath || dirPath, entry.name);
        try {
          const stat = await fs.stat(filePath);
          size += stat.size;
        } catch { /* skip */ }
      }
    }
    return size;
  } catch {
    return 0;
  }
}

export default createApiHandler(
  { methods: ['GET'], role: 'ADMIN' },
  async (_req, res) => {
    const UPLOAD_DIR = process.env.UPLOAD_DIR || './storage/uploads';
    const THUMBNAIL_DIR = process.env.THUMBNAIL_DIR || './storage/thumbnails';
    const PREVIEW_DIR = process.env.PREVIEW_DIR || './storage/previews';
    const TEMP_DIR = process.env.TEMP_DIR || './storage/temp';

    const [uploads, thumbnails, previews, temp, dbSize] = await Promise.all([
      getDirSize(UPLOAD_DIR),
      getDirSize(THUMBNAIL_DIR),
      getDirSize(PREVIEW_DIR),
      getDirSize(TEMP_DIR),
      prisma.asset.aggregate({ _sum: { size: true } }),
    ]);

    return ok(res, {
      disk: {
        uploads,
        thumbnails,
        previews,
        temp,
        total: uploads + thumbnails + previews + temp,
      },
      database: {
        totalAssetSize: dbSize._sum.size || 0,
      },
    });
  }
);
