import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { ActionLogEntry, ActionType } from '@/types';
import { useUserStore } from '@/stores/userStore';
import { compressProjectHistory, RECENT_WINDOW } from '@/lib/analytics/historyDigest';

interface LogState {
  entries: ActionLogEntry[];
  maxEntries: number;
  log: (type: ActionType, description: string, data?: Record<string, unknown>, undoable?: boolean) => void;
  clearLog: () => void;
  /** Recent entries for the CURRENT project (digests count as one entry). */
  getRecentEntries: (count: number) => ActionLogEntry[];
  getEntriesByType: (type: ActionType) => ActionLogEntry[];
  /** All entries (raw + digests) for the current project, newest first. */
  getEntriesForCurrentProject: () => ActionLogEntry[];
  undo: () => ActionLogEntry | undefined;
  /** The newest returnable workshop edit is marked returned. The line stays. */
  markLatestReturned: () => void;
}

function currentProjectId(): string | undefined {
  try {
    return useUserStore.getState().currentProject.id;
  } catch {
    return undefined;
  }
}

export const useLogStore = create<LogState>()(
  persist(
    (set, get) => ({
      entries: [],
      maxEntries: RECENT_WINDOW,

      log: (type, description, data, undoable = false) => {
        const projectId = currentProjectId();
        const entry: ActionLogEntry = {
          id: uuidv4(),
          type,
          timestamp: Date.now(),
          description,
          data,
          undoable,
          projectId,
        };

        set((state) => {
          const withNew = [entry, ...state.entries];
          // Keep the most recent RECENT_WINDOW full-detail entries per
          // project; fold anything older into per-day/type digests instead
          // of dropping them (see lib/analytics/historyDigest.ts).
          const compressed = compressProjectHistory(withNew, projectId);
          return { entries: compressed };
        });

        // Also log to console in dev
        if (process.env.NODE_ENV === 'development') {
          console.log(`[ACTION LOG] ${type}: ${description}`, data);
        }
      },

      clearLog: () => set({ entries: [] }),

      getEntriesForCurrentProject: () => {
        const projectId = currentProjectId();
        return get().entries.filter((e) => e.projectId === projectId);
      },

      getRecentEntries: (count) => {
        return get().getEntriesForCurrentProject().slice(0, count);
      },

      getEntriesByType: (type) => {
        return get().getEntriesForCurrentProject().filter((e) => e.type === type);
      },

      undo: () => {
        const undoableEntry = get().getEntriesForCurrentProject().find((e) => e.undoable);
        if (undoableEntry) {
          set((state) => ({
            entries: state.entries.filter((e) => e.id !== undoableEntry.id),
          }));
        }
        return undoableEntry;
      },

      markLatestReturned: () => {
        const projectId = currentProjectId();
        set((state) => {
          const index = state.entries.findIndex((entry) =>
            entry.projectId === projectId
            && entry.type === 'workshop_edit'
            && entry.undoable
            && !entry.data?.undone);
          if (index < 0) return state;
          const entries = state.entries.slice();
          const entry = entries[index];
          entries[index] = {
            ...entry,
            undoable: false,
            data: { ...(entry.data ?? {}), undone: true },
          };
          return { entries };
        });
      },
    }),
    {
      name: 'ars-technicai-log',
    }
  )
);
