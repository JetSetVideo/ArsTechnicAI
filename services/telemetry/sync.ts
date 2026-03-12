/**
 * Telemetry Sync — Send snapshots and error events to backend
 */

import { useTelemetryStore } from '@/stores/telemetryStore';
import { useErrorStore } from '@/stores/errorStore';
import type { TelemetryPayload } from '@/types/telemetry';
import type { TelemetrySnapshot } from '@/types/telemetry';
import type { ErrorEvent } from '@/types/telemetry';

const SYNC_ENDPOINT_SNAPSHOT = '/api/telemetry/snapshot';
const SYNC_ENDPOINT_EVENTS = '/api/telemetry/events';
const RETRY_DELAY_MS = 3000;
const MAX_RETRIES = 2;

function buildPayload(snapshot: TelemetrySnapshot): TelemetryPayload {
  return {
    sessionId: snapshot.sessionId,
    clientSignature: snapshot.clientSignature,
    device: {
      ...snapshot.device,
      deviceTier: snapshot.deviceTier,
      connectivityTier: snapshot.connectivityTier,
    },
    session: {
      startedAt: snapshot.sessionStartedAt,
      durationMs: snapshot.sessionDurationMs,
    },
    usage: snapshot.usage,
    paths: snapshot.paths,
    settingsDigest: snapshot.settingsDigest,
    projects: snapshot.projects,
    health: snapshot.health,
    storage: snapshot.storage,
    features: snapshot.features,
    appVersion: snapshot.clientSignature.split('-')[0]?.replace('v', '') ?? '1.0.0',
  };
}

export async function syncTelemetry(): Promise<{ snapshotOk: boolean; eventsOk: boolean }> {
  const telemetryEnabled = useTelemetryStore.getState().telemetryEnabled;
  if (!telemetryEnabled) return { snapshotOk: false, eventsOk: false };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { snapshotOk: false, eventsOk: false };
  }

  let snapshotOk = false;
  let eventsOk = false;

  const snapshot = useTelemetryStore.getState().getLatestSnapshot();
  if (snapshot) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(SYNC_ENDPOINT_SNAPSHOT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(snapshot)),
        });
        if (res.ok) {
          snapshotOk = true;
          useTelemetryStore.getState().setLastSyncedAt(Date.now());
          break;
        }
      } catch {
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }
    }
  }

  const unsynced = useErrorStore.getState().getUnsynced();
  if (unsynced.length > 0) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const sessionId = snapshot?.sessionId ?? unsynced[0]?.clientSignature ?? 'unknown';
        const res = await fetch(SYNC_ENDPOINT_EVENTS, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            clientSignature: unsynced[0]?.clientSignature ?? 'unknown',
            events: unsynced.map((e) => ({
              code: e.code,
              message: e.message,
              clientSignature: e.clientSignature,
              context: e.context,
              timestamp: e.timestamp,
            })),
          }),
        });
        if (res.ok) {
          eventsOk = true;
          useErrorStore.getState().markSynced(unsynced.map((e) => e.id));
          break;
        }
      } catch {
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }
    }
  }

  return { snapshotOk, eventsOk };
}
