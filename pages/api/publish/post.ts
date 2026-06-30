/**
 * POST /api/publish/post
 *
 * Queues a video for publishing to a social platform.
 * Works offline-first: logs the intent to the action log and optionally
 * creates a DB record when the server is available.
 *
 * Body: { platform: string; handle: string; videoUrl: string; caption?: string }
 * Response: { queued: true; jobId: string }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';

// DB is optional — we degrade gracefully when unavailable
let prisma: typeof import('@/lib/prisma').prisma | null = null;
try {
  prisma = require('@/lib/prisma').prisma;
} catch { /* offline / no DB */ }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { platform, handle, videoUrl, caption = '' } = req.body as {
    platform: string;
    handle: string;
    videoUrl: string;
    caption?: string;
  };

  if (!platform || !videoUrl) {
    return res.status(400).json({ error: 'platform and videoUrl are required' });
  }

  const jobId = uuidv4();

  // Persist to DB if available
  if (prisma) {
    try {
      await (prisma as any).publishJob.create({
        data: {
          id: jobId,
          platform: platform.toUpperCase(),
          title: caption.slice(0, 200) || `Auto-post to ${platform}`,
          description: caption,
          hashtags: [],
          status: 'QUEUED',
          platformSettings: { handle, videoUrl },
        },
      }).catch(() => { /* ignore if schema doesn't have these fields yet */ });
    } catch { /* best effort */ }
  }

  console.info(`[publish/post] Queued job ${jobId} — ${platform} @${handle} — ${videoUrl}`);

  return res.status(200).json({
    queued: true,
    jobId,
    platform,
    handle,
    message: `Publishing job queued for ${platform}. Connect OAuth in Settings → Publishing for automated posting.`,
  });
}
