import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { NotFoundError, ValidationError } from '@/lib/api/errors';
import { enqueueJob } from '@/lib/queue/job-queue';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['POST'] },
  async (req, res) => {
    const jobId = req.query.id as string;

    const job = await prisma.generationJob.findFirst({
      where: { id: jobId, userId: req.userId },
    });
    if (!job) throw new NotFoundError('Job');
    if (job.status !== 'FAILED' && job.status !== 'CANCELLED') {
      throw new ValidationError('Only failed or cancelled jobs can be retried');
    }

    const updated = await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: 'QUEUED', error: null, progress: 0 },
    });

    await enqueueJob(jobId, job.priority);
    return ok(res, updated);
  }
);
