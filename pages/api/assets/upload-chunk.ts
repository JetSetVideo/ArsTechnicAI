import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';
import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';

export const config = {
  api: { bodyParser: false },
};

const TEMP_DIR = process.env.TEMP_DIR || './storage/temp';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { message: 'Method not allowed' } });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
  }

  const form = formidable({
    maxFileSize: 50 * 1024 * 1024, // 50MB per chunk
  });

  try {
    const [fields, files] = await form.parse(req);
    const chunk = files.chunk?.[0];
    const uploadId = fields.uploadId?.[0];
    const chunkIndex = parseInt(fields.chunkIndex?.[0] || '0');
    const totalChunks = parseInt(fields.totalChunks?.[0] || '1');

    if (!chunk || !uploadId) {
      return res.status(400).json({ success: false, error: { message: 'Missing chunk or uploadId' } });
    }

    const chunkDir = path.join(TEMP_DIR, uploadId);
    await fs.mkdir(chunkDir, { recursive: true });

    const chunkPath = path.join(chunkDir, `chunk-${String(chunkIndex).padStart(5, '0')}`);
    await fs.rename(chunk.filepath, chunkPath);

    // Check if all chunks received
    const chunkFiles = await fs.readdir(chunkDir);
    const isComplete = chunkFiles.length === totalChunks;

    return res.status(200).json({
      success: true,
      data: {
        uploadId,
        chunkIndex,
        totalChunks,
        received: chunkFiles.length,
        complete: isComplete,
      },
    });
  } catch (error) {
    console.error('Chunk upload error:', error);
    return res.status(500).json({ success: false, error: { message: 'Chunk upload failed' } });
  }
}
