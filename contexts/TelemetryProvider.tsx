/**
 * TelemetryProvider — Runs gather → digest → store → sync at startup
 */

import { useEffect, useRef } from 'react';
import { useUserStore } from '@/stores/userStore';
import { useLogStore } from '@/stores/logStore';
import { useFileStore } from '@/stores/fileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProjectsStore } from '@/stores/projectsStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useTelemetryStore } from '@/stores/telemetryStore';
import { gatherStorageEstimate, gatherFromStores } from '@/services/telemetry/gather';
import { digestGatheredData } from '@/services/telemetry/digest';
import { syncTelemetry } from '@/services/telemetry/sync';

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const ranRef = useRef(false);
  const refreshDeviceInfo = useUserStore((s) => s.refreshDeviceInfo);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const run = async () => {
      refreshDeviceInfo();

      const [storage, healthRes] = await Promise.all([
        gatherStorageEstimate(),
        fetch('/api/health').then((r) => r.json()).catch(() => null),
      ]);

      const health = healthRes
        ? {
            status: healthRes.status as 'ok' | 'degraded' | 'error',
            services: healthRes.services ?? [],
            checkedAt: healthRes.timestamp ?? Date.now(),
          }
        : null;

      useTelemetryStore.getState().setHealth(health);

      const gathered = gatherFromStores({
        userStore: useUserStore.getState(),
        logStore: useLogStore.getState(),
        fileStore: useFileStore.getState(),
        settingsStore: useSettingsStore.getState(),
        projectsStore: useProjectsStore.getState(),
        canvasStore: useCanvasStore.getState(),
      });

      const fullGathered = { ...gathered, storage, features: gathered.features };
      const snapshot = digestGatheredData(fullGathered, health);

      useTelemetryStore.getState().upsertSnapshot(snapshot);

      if (useTelemetryStore.getState().telemetryEnabled) {
        syncTelemetry().catch(() => {});
      }
    };

    run();
  }, [refreshDeviceInfo]);

  return <>{children}</>;
}
