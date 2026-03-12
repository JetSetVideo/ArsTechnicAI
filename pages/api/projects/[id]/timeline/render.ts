import { createApiHandler } from '@/lib/api/handler';
import { created } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['POST'], role: 'CREATOR' },
  async (req, res) => {
    const projectId = req.query.id as string;

    // Create a transcoding job for the timeline render
    const job = await prisma.generationJob.create({
      data: {
        userId: req.userId,
        projectId,
        type: 'TRANSCODING',
        provider: 'CUSTOM',
        status: 'QUEUED',
        requestParams: req.body || {},
      },
    });

    return created(res, job);
  }
);
