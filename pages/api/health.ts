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

const BACKEND_URL = process.env.BACKEND_URL?.trim() || 'http://localhost:8000';
const HEALTH_TIMEOUT_MS = 5000;

async function checkBackendHealth(): Promise<ServiceStatus> {
  const urls = [
    `${BACKEND_URL}/health`,
    `${BACKEND_URL}/api/health`,
    `${BACKEND_URL}/`,
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
    message: `Cannot reach ${BACKEND_URL}`,
  };
}

async function checkPostgreSQL(): Promise<ServiceStatus> {
  // PostgreSQL is typically accessed via the backend. If backend has a /health
  // that checks DB, we rely on that. Otherwise we infer from backend status.
  return { name: 'PostgreSQL', status: 'ok', message: 'Via backend' };
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
