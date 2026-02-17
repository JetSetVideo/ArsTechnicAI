/**
 * Error Store — Persisted error events for sync
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { computeClientSignature } from '@/utils/clientSignature';
import { deriveDeviceTier, deriveConnectivityTier } from '@/utils/clientSignature';
import type { ErrorEvent } from '@/types/telemetry';
import { STORAGE_KEYS } from '@/constants/workspace';

const MAX_EVENTS = 100;

interface ErrorState {
  events: ErrorEvent[];
  append: (params: {
    code: string;
    message: string;
    context?: Record<string, unknown>;
    deviceTier?: 'low' | 'medium' | 'high' | 'unknown';
    connectivityTier?: 'slow' | '3g' | '4g' | 'unknown';
  }) => void;
  markSynced: (ids: string[]) => void;
  getUnsynced: () => ErrorEvent[];
  clear: () => void;
}

export const useErrorStore = create<ErrorState>()(
  persist(
    (set, get) => ({
      events: [],

      append: (params) => {
        const deviceTier = params.deviceTier ?? 'unknown';
        const connectivityTier = params.connectivityTier ?? 'unknown';
        const clientSignature = computeClientSignature(deviceTier, connectivityTier);
        const event: ErrorEvent = {
          id: uuidv4(),
          timestamp: Date.now(),
          code: params.code,
          message: params.message,
          clientSignature,
          context: params.context,
          synced: false,
        };
        set((state) => ({
          events: [event, ...state.events].slice(0, MAX_EVENTS),
        }));
      },

      markSynced: (ids) => {
        const setIds = new Set(ids);
        set((state) => ({
          events: state.events.map((e) =>
            setIds.has(e.id) ? { ...e, synced: true } : e
          ),
        }));
      },

      getUnsynced: () => get().events.filter((e) => !e.synced),

      clear: () => set({ events: [] }),
    }),
    {
      name: STORAGE_KEYS.errors,
    }
  )
);
