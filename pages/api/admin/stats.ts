import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['GET'], role: 'ADMIN' },
  async (_req, res) => {
    const [users, projects, assets, jobs, recentJobs] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.asset.count(),
      prisma.generationJob.count(),
      prisma.generationJob.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    const jobsByStatus = Object.fromEntries(
      recentJobs.map((r) => [r.status, r._count])
    );

    return ok(res, {
      users,
      projects,
      assets,
      totalJobs: jobs,
      jobsByStatus,
    });
  }
);
