import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import redis from '@/lib/redis';
import { getQueueStats } from '@/lib/queue/job-queue';
import os from 'os';

export default createApiHandler(
  { methods: ['GET'], role: 'SUPERADMIN' },
  async (_req, res) => {
    const checks: Record<string, unknown> = {};

    // Database
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'ok', latencyMs: Date.now() - start };
    } catch (e) {
      checks.database = { status: 'error', error: (e as Error).message };
    }

    // Redis
    try {
      const start = Date.now();
      await redis.ping();
      const info = await redis.info('memory');
      const usedMemory = info.match(/used_memory_human:(.+)/)?.[1]?.trim();
      checks.redis = { status: 'ok', latencyMs: Date.now() - start, usedMemory };
    } catch (e) {
      checks.redis = { status: 'error', error: (e as Error).message };
    }

    // Job queue
    try {
      const stats = await getQueueStats();
      checks.jobQueue = { status: 'ok', ...stats };
    } catch (e) {
      checks.jobQueue = { status: 'error', error: (e as Error).message };
    }

    // System
    checks.system = {
      uptime: os.uptime(),
      loadAvg: os.loadavg(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus().length,
    };

    const allOk = ['database', 'redis', 'jobQueue'].every(
      (k) => (checks[k] as { status: string })?.status === 'ok'
    );

    return ok(res, {
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    });
  }
);
