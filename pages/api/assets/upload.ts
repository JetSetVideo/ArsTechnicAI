import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';
import formidable from 'formidable';
import fs from 'fs/promises';
import { saveFile } from '@/lib/storage/local';
import { processMedia } from '@/lib/media/processor';
import { getMimeType, mimeToAssetType } from '@/lib/utils/mime';
import { sha256 } from '@/lib/utils/checksum';
import { prisma } from '@/lib/prisma';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { message: 'Method not allowed' } });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
  }

  const form = formidable({
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '500') * 1024 * 1024,
  });

  try {
    const [fields, files] = await form.parse(req);
    const file = files.file?.[0];
    if (!file) {
      return res.status(400).json({ success: false, error: { message: 'No file provided' } });
    }

    const buffer = await fs.readFile(file.filepath);
    const mimeType = file.mimetype || getMimeType(file.originalFilename || 'file');
    const filename = file.originalFilename || 'upload';

    // Save file to storage
    const filePath = await saveFile(buffer, filename, 'upload');

    // Process media (thumbnails, previews, metadata)
    const processed = await processMedia(buffer, mimeType, filename);

    // Compute checksum
    const checksum = sha256(buffer);

    // Create asset record
    const asset = await prisma.asset.create({
      data: {
        name: fields.name?.[0] || filename,
        type: mimeToAssetType(mimeType),
        status: 'READY',
        path: filePath,
        originalFilename: filename,
        mimeType,
        size: buffer.length,
        width: processed.width,
        height: processed.height,
        duration: processed.duration,
        thumbnailPath: processed.thumbnailPath,
        previewPath: processed.previewPath,
        checksum,
        colorPalette: processed.colorPalette,
        metadata: processed.metadata,
        userId: session.user.id,
        projectId: fields.projectId?.[0] || null,
      },
    });

    // Clean up temp file
    await fs.unlink(file.filepath).catch(() => {});

    return res.status(201).json({ success: true, data: asset });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ success: false, error: { message: 'Upload failed' } });
  }
}
