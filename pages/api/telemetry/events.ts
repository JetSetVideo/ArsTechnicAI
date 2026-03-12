/**
 * Telemetry Events API — Batch error events
 */

import type { NextApiRequest, NextApiResponse } from 'next';

interface EventInput {
  code: string;
  message: string;
  clientSignature?: string;
  context?: Record<string, unknown>;
  timestamp?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok: boolean; received?: number; error?: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = req.body as { sessionId?: string; clientSignature?: string; events?: EventInput[] };
    const events = Array.isArray(body.events) ? body.events : [];
    const sessionId = body.sessionId ?? 'unknown';
    const clientSignature = body.clientSignature ?? 'unknown';

    if (events.length === 0) {
      return res.status(200).json({ ok: true, received: 0 });
    }

    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      await prisma.telemetryErrorEvent.createMany({
        data: events.map((e) => ({
          sessionId,
          clientSignature: e.clientSignature ?? clientSignature,
          code: e.code,
          message: e.message,
          context: e.context ? JSON.parse(JSON.stringify(e.context)) : undefined,
        })),
      });

      await prisma.$disconnect();
      return res.status(200).json({ ok: true, received: events.length });
    } catch (dbError) {
      if (process.env.DATABASE_URL) {
        console.error('[Telemetry] Events DB error:', dbError);
      }
      return res.status(200).json({ ok: true, received: events.length });
    }
  } catch (e) {
    console.error('[Telemetry] Events error:', e);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
