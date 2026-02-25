/**
 * Health check API
 *
 * Probes the home server (BACKEND_URL) and related services at startup.
 * Used by ConnectionBanner to display status: green (ok), orange (degraded), red (error).
 */

import type { NextApiRequest, NextApiResponse } from 'next';

export type HealthStatus = 'ok' | 'degraded' | 'error';

export interface ServiceStatus {
  name: string;
  status: HealthStatus;
  message?: string;
}

export interface HealthResponse {
  status: HealthStatus;
  services: ServiceStatus[];
  timestamp: number;
}

const HEALTH_TIMEOUT_MS = 5000;

async function checkBackendHealth(): Promise<ServiceStatus> {
  const configuredBackend = process.env.BACKEND_URL?.trim();

  // Default mode: backend is bundled in this same Next.js server (/api/* routes).
  // In this mode, don't probe an external URL and don't show red warnings.
  if (!configuredBackend) {
    return {
      name: 'Backend API',
      status: 'ok',
      message: 'Using local Next.js API routes',
    };
  }

  const urls = [
    `${configuredBackend}/health`,
    `${configuredBackend}/api/health`,
    `${configuredBackend}/`,
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeout);

      if (res.ok) {
        return { name: 'Backend API', status: 'ok', message: 'Connected' };
      }
      return { name: 'Backend API', status: 'degraded', message: `HTTP ${res.status}` };
    } catch (e) {
      // Try next URL
    }
  }

  return {
    name: 'Backend API',
    status: 'error',
    message: `Cannot reach ${configuredBackend}`,
  };
}

async function checkPostgreSQL(): Promise<ServiceStatus> {
  const configuredBackend = process.env.BACKEND_URL?.trim();

  // If using external backend, we assume backend checks DB or we don't know.
  if (configuredBackend) {
    return { name: 'PostgreSQL', status: 'ok', message: 'Via backend' };
  }

  // Local Next.js API route mode: check Prisma directly.
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    return { name: 'PostgreSQL', status: 'ok', message: 'Connected to local DB' };
  } catch (error) {
    return { name: 'PostgreSQL', status: 'error', message: 'Database unreachable' };
  }
}

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<HealthResponse | { error: string }>
) {
  try {
    const [backend, postgres] = await Promise.all([
      checkBackendHealth(),
      checkPostgreSQL(),
    ]);

    const services: ServiceStatus[] = [backend, postgres];

    // If backend fails, PostgreSQL is considered unknown
    if (backend.status === 'error') {
      services[1] = { name: 'PostgreSQL', status: 'degraded', message: 'Backend unreachable' };
    }

    const hasError = services.some((s) => s.status === 'error');
    const hasDegraded = services.some((s) => s.status === 'degraded');
    const overallStatus: HealthStatus = hasError ? 'error' : hasDegraded ? 'degraded' : 'ok';

    res.status(200).json({
      status: overallStatus,
      services,
      timestamp: Date.now(),
    });
  } catch {
    res.status(200).json({
      status: 'error',
      services: [
        { name: 'Backend API', status: 'error', message: 'Health check failed' },
        { name: 'PostgreSQL', status: 'error', message: 'Health check failed' },
      ],
      timestamp: Date.now(),
    });
  }
}
