import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { getQueueStats, getQueuedJobIds } from '@/lib/queue/job-queue';

export default createApiHandler(
  { methods: ['GET'] },
  async (_req, res) => {
    const stats = await getQueueStats();
    const queuedIds = await getQueuedJobIds(10);
    return ok(res, { ...stats, queuedJobIds: queuedIds });
  }
);
