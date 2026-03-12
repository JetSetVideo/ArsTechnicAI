import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();

  const jobId = req.query.id as string;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  let closed = false;
  req.on('close', () => { closed = true; });

  const send = (data: unknown) => {
    if (!closed) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  const poll = async () => {
    if (closed) return;

    try {
      const job = await prisma.generationJob.findFirst({
        where: { id: jobId, userId: session.user.id },
        select: {
          id: true,
          status: true,
          progress: true,
          progressMessage: true,
          error: true,
          resultAssetId: true,
          completedAt: true,
          updatedAt: true,
        },
      });

      if (!job) {
        send({ error: 'Job not found' });
        res.end();
        return;
      }

      send(job);

      if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
        res.end();
        return;
      }
    } catch {
      send({ error: 'Internal error' });
      res.end();
      return;
    }

    setTimeout(poll, 1500);
  };

  // Start polling, send heartbeat every 20s to keep connection alive
  poll();
  const heartbeat = setInterval(() => {
    if (closed) {
      clearInterval(heartbeat);
      return;
    }
    res.write(': heartbeat\n\n');
  }, 20_000);

  req.on('close', () => clearInterval(heartbeat));
}

export const config = {
  api: { externalResolver: true },
};
