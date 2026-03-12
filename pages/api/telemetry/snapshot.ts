/**
 * Telemetry Snapshot API — Receive startup/session snapshot
 */

import type { NextApiRequest, NextApiResponse } from 'next';

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

      const snapshot = await prisma.telemetrySnapshot.create({
        data: {
          sessionId,
          clientSignature,
          deviceTier: device?.deviceTier as string | undefined,
          connectivityTier: device?.connectivityTier as string | undefined,
          platform: device?.platform as string | undefined,
          screenWidth: device?.screenWidth as number | undefined,
          screenHeight: device?.screenHeight as number | undefined,
          sessionStartedAt: session?.startedAt
            ? new Date(session.startedAt as number)
            : new Date(),
          sessionDurationMs: (session?.durationMs as number) ?? 0,
          generationsCount: (usage?.generations as number) ?? 0,
          importsCount: (usage?.imports as number) ?? 0,
          exportsCount: (usage?.exports as number) ?? 0,
          projectsOpened: (usage?.projectsOpened as number) ?? 0,
          canvasItems: (usage?.canvasItems as number) ?? 0,
          healthStatus: (body.health as { status?: string })?.status,
          healthServices: (body.health as { services?: unknown })?.services ?? undefined,
          healthCheckedAt: (body.health as { checkedAt?: number })?.checkedAt
            ? new Date((body.health as { checkedAt: number }).checkedAt)
            : undefined,
          appVersion: body.appVersion as string | undefined,
          payload: JSON.parse(JSON.stringify(body)),
        },
      });

      await prisma.$disconnect();
      return res.status(200).json({ ok: true, id: snapshot.id });
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
