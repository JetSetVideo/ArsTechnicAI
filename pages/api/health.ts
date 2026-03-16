import type { NextApiRequest, NextApiResponse } from 'next';

export interface ServiceStatus {
  name: string;
  status: 'ok' | 'degraded' | 'error';
  message?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  timestamp: number;
  services: ServiceStatus[];
  checks: Record<string, string>;
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse<HealthResponse>) {
  const services: ServiceStatus[] = [];
  const checks: Record<string, string> = {};

  try {
    const { prisma } = await import('@/lib/prisma');
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
    services.push({ name: 'Database', status: 'ok' });
  } catch (e) {
    checks.database = 'error';
    services.push({ name: 'Database', status: 'error', message: e instanceof Error ? e.message : 'Unreachable' });
  }

  try {
    const { default: redis } = await import('@/lib/redis');
    await redis.ping();
    checks.redis = 'ok';
    services.push({ name: 'Redis', status: 'ok' });
  } catch (e) {
    checks.redis = 'error';
    services.push({ name: 'Redis', status: 'error', message: e instanceof Error ? e.message : 'Unreachable' });
  }

  const allOk = services.every((s) => s.status === 'ok');
  const allDown = services.every((s) => s.status === 'error');
  const status = allOk ? 'ok' : allDown ? 'error' : 'degraded';

  return res.status(allOk ? 200 : 503).json({
    status,
    version: process.env.npm_package_version ?? '1.0.0',
    timestamp: Date.now(),
    services,
    checks,
  });
}
