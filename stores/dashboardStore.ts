/**
 * Dashboard Store — home page filters, publishing accounts, usage counters.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  DashboardAssetCategory,
  DashboardFilters,
  DashboardMainView,
  DashboardProjectScope,
  PublishingAccount,
  SocialPlatformId,
} from '@/types/dashboard';
import type { DashboardSourceId } from '@/types/dashboard';
import { STORAGE_KEYS } from '@/constants/workspace';

const defaultFilters: DashboardFilters = {
  category: 'all',
  projectScope: 'all',
  sourceScope: 'all',
  mainView: 'projects',
};

const defaultAccounts: PublishingAccount[] = [
  { id: 'pub-instagram', platform: 'instagram', handle: '', connected: false, postsCount: 0 },
  { id: 'pub-youtube', platform: 'youtube', handle: '', connected: false, postsCount: 0 },
  { id: 'pub-tiktok', platform: 'tiktok', handle: '', connected: false, postsCount: 0 },
];

interface DashboardState {
  filters: DashboardFilters;
  publishingAccounts: PublishingAccount[];
  tokensTracked: number;
}

interface DashboardActions {
  setCategory: (category: DashboardAssetCategory) => void;
  setProjectScope: (scope: DashboardProjectScope) => void;
  setSourceScope: (scope: DashboardSourceId | 'all') => void;
  setMainView: (view: DashboardMainView) => void;
  resetFilters: () => void;

  upsertPublishingAccount: (
    platform: SocialPlatformId,
    updates: Partial<Pick<PublishingAccount, 'handle' | 'displayName' | 'connected'>>
  ) => void;
  recordPost: (accountId: string) => void;
  addTokensUsed: (count: number) => void;
}

type DashboardStore = DashboardState & DashboardActions;

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      filters: defaultFilters,
      publishingAccounts: defaultAccounts,
      tokensTracked: 0,

      setCategory: (category) =>
        set((state) => ({
          filters: { ...state.filters, category },
        })),

      setProjectScope: (projectScope) =>
        set((state) => ({
          filters: { ...state.filters, projectScope },
        })),

      setSourceScope: (sourceScope) =>
        set((state) => ({
          filters: { ...state.filters, sourceScope },
        })),

      setMainView: (mainView) =>
        set((state) => ({
          filters: { ...state.filters, mainView },
        })),

      resetFilters: () => set({ filters: defaultFilters }),

      upsertPublishingAccount: (platform, updates) => {
        set((state) => {
          const existing = state.publishingAccounts.find((a) => a.platform === platform);
          if (existing) {
            return {
              publishingAccounts: state.publishingAccounts.map((a) =>
                a.platform === platform ? { ...a, ...updates } : a
              ),
            };
          }
          return {
            publishingAccounts: [
              ...state.publishingAccounts,
              {
                id: `pub-${uuidv4()}`,
                platform,
                handle: updates.handle ?? '',
                displayName: updates.displayName,
                connected: updates.connected ?? false,
                postsCount: 0,
              },
            ],
          };
        });
      },

      recordPost: (accountId) => {
        set((state) => ({
          publishingAccounts: state.publishingAccounts.map((a) =>
            a.id === accountId
              ? { ...a, postsCount: a.postsCount + 1, lastPostedAt: Date.now() }
              : a
          ),
        }));
      },

      addTokensUsed: (count) => {
        if (count <= 0) return;
        set((state) => ({ tokensTracked: state.tokensTracked + count }));
      },
    }),
    {
      name: STORAGE_KEYS.dashboard,
      merge: (persisted, current) => {
        const p = persisted as Partial<DashboardStore> | undefined;
        if (!p?.filters) return current;
        return {
          ...current,
          ...p,
          filters: {
            ...defaultFilters,
            ...p.filters,
            sourceScope: p.filters.sourceScope ?? 'all',
          },
        };
      },
      partialize: (state) => ({
        filters: state.filters,
        publishingAccounts: state.publishingAccounts,
        tokensTracked: state.tokensTracked,
      }),
    }
  )
);

export function getPublishingAccount(
  accounts: PublishingAccount[],
  platform: SocialPlatformId
): PublishingAccount | undefined {
  return accounts.find((a) => a.platform === platform);
}
