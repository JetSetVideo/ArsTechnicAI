import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { cleanTempFiles } from '@/lib/storage/local';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['POST'], role: 'SUPERADMIN' },
  async (_req, res) => {
    // Clean temp files older than 1 hour
    const tempCleaned = await cleanTempFiles(3600000);

    // Clean orphaned jobs (stuck in PROCESSING > 1 hour)
    const stuckJobs = await prisma.generationJob.updateMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: new Date(Date.now() - 3600000) },
      },
      data: { status: 'FAILED', error: 'Timed out' },
    });

    return ok(res, {
      tempFilesCleaned: tempCleaned,
      stuckJobsReset: stuckJobs.count,
    });
  }
);
