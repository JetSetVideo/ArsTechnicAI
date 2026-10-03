import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Device-sync status for the UI (Settings → Data, the connection strip). */

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'signed-out' | 'error';

export interface SyncConflict {
  projectId: string;
  name: string;
  /** The local version, kept as its own project. */
  copyId: string;
  copyName: string;
  serverDevice: string | null;
  at: number;
}

export interface SyncReport {
  startedAt: number;
  finishedAt: number;
  pushed: string[];
  pulled: string[];
  conflicts: SyncConflict[];
  /** Projects left alone because they are open (pulling under an open editor would be overwritten by its autosave). */
  deferred: { id: string; name: string }[];
  assetsUp: number;
  assetsDown: number;
  errors: string[];
}

interface SyncState {
  status: SyncStatus;
  lastSyncAt: number | null;
  lastError: string | null;
  lastReport: SyncReport | null;
  conflicts: SyncConflict[];
  setStatus: (status: SyncStatus, error?: string | null) => void;
  finish: (report: SyncReport) => void;
  dismissConflict: (copyId: string) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      status: 'idle',
      lastSyncAt: null,
      lastError: null,
      lastReport: null,
      conflicts: [],
      setStatus: (status, error = null) => set({ status, lastError: error }),
      finish: (report) =>
        set((s) => ({
          status: report.errors.length ? 'error' : 'idle',
          lastError: report.errors[0] ?? null,
          lastSyncAt: report.finishedAt,
          lastReport: report,
          conflicts: [...report.conflicts, ...s.conflicts].slice(0, 50),
        })),
      dismissConflict: (copyId) => set((s) => ({ conflicts: s.conflicts.filter((c) => c.copyId !== copyId) })),
    }),
    {
      name: 'ars-sync',
      partialize: (s) => ({ status: s.status === 'syncing' ? 'idle' : s.status, lastError: s.lastError, lastSyncAt: s.lastSyncAt, conflicts: s.conflicts, lastReport: s.lastReport }),
    }
  )
);
