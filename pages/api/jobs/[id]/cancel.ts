import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { NotFoundError } from '@/lib/api/errors';
import { cancelJob } from '@/lib/queue/job-queue';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['POST'] },
  async (req, res) => {
    const jobId = req.query.id as string;

    const job = await prisma.generationJob.findFirst({
      where: { id: jobId, userId: req.userId },
    });
    if (!job) throw new NotFoundError('Job');

    await cancelJob(jobId);
    const updated = await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED' },
    });

    return ok(res, updated);
  }
);
