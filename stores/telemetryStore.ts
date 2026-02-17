/**
 * Telemetry Store — Startup snapshots and sync state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TelemetrySnapshot, HealthStatus, ServiceStatus } from '@/types/telemetry';
import { STORAGE_KEYS } from '@/constants/workspace';

const MAX_SNAPSHOTS = 10;

interface TelemetryState {
  snapshots: TelemetrySnapshot[];
  lastSyncedAt: number | null;
  health: { status: HealthStatus; services: ServiceStatus[]; checkedAt: number } | null;
  telemetryEnabled: boolean;

  upsertSnapshot: (snapshot: TelemetrySnapshot) => void;
  setHealth: (health: { status: HealthStatus; services: ServiceStatus[]; checkedAt: number } | null) => void;
  setLastSyncedAt: (ts: number) => void;
  setTelemetryEnabled: (enabled: boolean) => void;
  getLatestSnapshot: () => TelemetrySnapshot | null;
  clear: () => void;
}

export const useTelemetryStore = create<TelemetryState>()(
  persist(
    (set, get) => ({
      snapshots: [],
      lastSyncedAt: null,
      health: null,
      telemetryEnabled: true,

      upsertSnapshot: (snapshot) => {
        set((state) => {
          const list = [snapshot, ...state.snapshots.filter((s) => s.id !== snapshot.id)].slice(
            0,
            MAX_SNAPSHOTS
          );
          return { snapshots: list };
        });
      },

      setHealth: (health) => set({ health }),

      setLastSyncedAt: (ts) => set({ lastSyncedAt: ts }),

      setTelemetryEnabled: (enabled) => set({ telemetryEnabled: enabled }),

      getLatestSnapshot: () => {
        const list = get().snapshots;
        return list.length > 0 ? list[0] : null;
      },

      clear: () => set({ snapshots: [], lastSyncedAt: null, health: null }),
    }),
    {
      name: STORAGE_KEYS.telemetry,
      partialize: (s) => ({
        snapshots: s.snapshots,
        lastSyncedAt: s.lastSyncedAt,
        telemetryEnabled: s.telemetryEnabled,
      }),
    }
  )
);
