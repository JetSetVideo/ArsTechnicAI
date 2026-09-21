/**
 * Telemetry Snapshot API — Receive startup/session snapshot
 */

import type { NextApiRequest, NextApiResponse } from 'next';

type TelemetrySnapshotDelegate = {
  create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
};

// Postgres INT4 ceiling. Some values are client-supplied and can legitimately
// exceed 32 bits — e.g. `session.durationMs` is derived from a persisted
// `startedAt` that is never rotated, so it grows unbounded and overflows after
// ~24.86 days, making the entire insert fail with a conversion error. Clamp
// every integer column defensively so a bad client value can never break
// persistence.
const INT4_MAX = 2_147_483_647;

function clampInt(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(INT4_MAX, Math.max(0, Math.trunc(n)));
}

// Coerce a client-supplied epoch-ms value to a valid Date, falling back to now
// so an unparseable/absurd timestamp can't fail the insert.
function safeDate(value: unknown): Date {
  const n = typeof value === 'number' ? value : Number(value);
  const d = new Date(n);
  return Number.isFinite(n) && !Number.isNaN(d.getTime()) ? d : new Date();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok: boolean; id?: string; error?: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = req.body as Record<string, unknown>;
    const sessionId = body.sessionId as string;
    const clientSignature = body.clientSignature as string;
    const device = body.device as Record<string, unknown> | undefined;
    const session = body.session as Record<string, unknown> | undefined;
    const usage = body.usage as Record<string, unknown> | undefined;

    if (!sessionId || !clientSignature) {
      return res.status(400).json({ ok: false, error: 'Missing sessionId or clientSignature' });
    }

    // Try Prisma if DATABASE_URL is set
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      try {
        const telemetrySnapshot = (prisma as unknown as {
          telemetrySnapshot?: TelemetrySnapshotDelegate;
        }).telemetrySnapshot;

        if (!telemetrySnapshot) {
          return res.status(200).json({ ok: true });
        }

        const snapshot = await telemetrySnapshot.create({
          data: {
            sessionId,
            clientSignature,
            deviceTier: device?.deviceTier as string | undefined,
            connectivityTier: device?.connectivityTier as string | undefined,
            platform: device?.platform as string | undefined,
            screenWidth: clampInt(device?.screenWidth),
            screenHeight: clampInt(device?.screenHeight),
            sessionStartedAt: safeDate(session?.startedAt),
            sessionDurationMs: clampInt(session?.durationMs),
            generationsCount: clampInt(usage?.generations),
            importsCount: clampInt(usage?.imports),
            exportsCount: clampInt(usage?.exports),
            projectsOpened: clampInt(usage?.projectsOpened),
            canvasItems: clampInt(usage?.canvasItems),
            healthStatus: (body.health as { status?: string })?.status,
            healthServices: (body.health as { services?: unknown })?.services ?? undefined,
            healthCheckedAt: (body.health as { checkedAt?: number })?.checkedAt
              ? new Date((body.health as { checkedAt: number }).checkedAt)
              : undefined,
            appVersion: body.appVersion as string | undefined,
            payload: JSON.parse(JSON.stringify(body)),
          },
        });

        return res.status(200).json({ ok: true, id: snapshot.id });
      } finally {
        await prisma.$disconnect();
      }
    } catch (dbError) {
      // DATABASE_URL not set or Prisma not configured — accept but don't persist
      if (process.env.DATABASE_URL) {
        console.error('[Telemetry] DB error:', dbError);
      }
      return res.status(200).json({ ok: true });
    }
  } catch (e) {
    console.error('[Telemetry] Snapshot error:', e);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
