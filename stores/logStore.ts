import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { ActionLogEntry, ActionType } from '@/types';

interface LogState {
  entries: ActionLogEntry[];
  maxEntries: number;
  log: (type: ActionType, description: string, data?: Record<string, unknown>, undoable?: boolean) => void;
  clearLog: () => void;
  getRecentEntries: (count: number) => ActionLogEntry[];
  getEntriesByType: (type: ActionType) => ActionLogEntry[];
  undo: () => ActionLogEntry | undefined;
}

export const useLogStore = create<LogState>()(
  persist(
    (set, get) => ({
      entries: [],
      maxEntries: 1000,

      log: (type, description, data, undoable = false) => {
        const entry: ActionLogEntry = {
          id: uuidv4(),
          type,
          timestamp: Date.now(),
          description,
          data,
          undoable,
        };

        set((state) => {
          const newEntries = [entry, ...state.entries];
          // Trim to max entries
          if (newEntries.length > state.maxEntries) {
            newEntries.pop();
          }
          return { entries: newEntries };
        });

        // Also log to console in dev
        if (process.env.NODE_ENV === 'development') {
          console.log(`[ACTION LOG] ${type}: ${description}`, data);
        }
      },

      clearLog: () => set({ entries: [] }),

      getRecentEntries: (count) => {
        return get().entries.slice(0, count);
      },

      getEntriesByType: (type) => {
        return get().entries.filter((e) => e.type === type);
      },

      undo: () => {
        const undoableEntry = get().entries.find((e) => e.undoable);
        if (undoableEntry) {
          set((state) => ({
            entries: state.entries.filter((e) => e.id !== undoableEntry.id),
          }));
        }
        return undoableEntry;
      },
    }),
    {
      name: 'ars-technicai-log',
    }
  )
);
