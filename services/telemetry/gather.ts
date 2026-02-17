/**
 * Telemetry Gather — Collect raw data from stores and browser APIs
 */

import type { DeviceInfo } from '@/stores/userStore';
import { gatherFeatureFlags } from '@/utils/clientSignature';
import type { ActionType } from '@/types';

export interface GatheredData {
  device: DeviceInfo | null;
  storage: { quota: number; usage: number; usagePercent: number } | null;
  features: Record<string, boolean>;
  sessionId: string;
  sessionStartedAt: number;
  usage: {
    generations: number;
    imports: number;
    exports: number;
    projectsOpened: number;
    canvasItems: number;
  };
  logEntriesByType: Partial<Record<ActionType, number>>;
  currentProjectPath: string;
  rootFolderCount: number;
  assetCount: number;
  settingsDigest: {
    provider: string;
    fontSize: string;
    compactMode: boolean;
    showGrid: boolean;
  };
  projectCount: number;
  recentProjectCount: number;
}

export async function gatherStorageEstimate(): Promise<{
  quota: number;
  usage: number;
  usagePercent: number;
} | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate();
    const usagePercent = quota > 0 ? Math.round((usage / quota) * 100) : 0;
    return { quota, usage, usagePercent };
  } catch {
    return null;
  }
}

export function gatherFromStores(stores: {
  userStore: { deviceInfo: DeviceInfo | null; session: { sessionId: string; startedAt: number; generationsCount: number; importsCount: number; exportsCount: number }; recentProjects: { length: number } };
  logStore: { entries: { type: ActionType }[] };
  fileStore: { currentProjectPath: string; rootNodes: unknown[]; assets: Map<string, unknown> };
  settingsStore: { settings: { appearance?: { fontSize?: string }; aiProvider?: { provider?: string }; showGrid?: boolean } };
  projectsStore: { projects: unknown[]; recentProjectIds: string[] };
  canvasStore: { items: unknown[] };
}): Omit<GatheredData, 'storage'> {
  const { userStore, logStore, fileStore, settingsStore, projectsStore, canvasStore } = stores;

  const logEntriesByType: Partial<Record<ActionType, number>> = {};
  for (const e of logStore.entries) {
    logEntriesByType[e.type] = (logEntriesByType[e.type] ?? 0) + 1;
  }

  const appearance = (settingsStore.settings?.appearance ?? {}) as {
    fontSize?: string;
    compactMode?: boolean;
  };
  const aiProvider = (settingsStore.settings?.aiProvider ?? {}) as { provider?: string };

  return {
    device: userStore.deviceInfo,
    features: gatherFeatureFlags(),
    sessionId: userStore.session.sessionId,
    sessionStartedAt: userStore.session.startedAt,
    usage: {
      generations: userStore.session.generationsCount,
      imports: userStore.session.importsCount,
      exports: userStore.session.exportsCount,
      projectsOpened: userStore.recentProjects.length,
      canvasItems: canvasStore.items.length,
    },
    logEntriesByType,
    currentProjectPath: fileStore.currentProjectPath || '/',
    rootFolderCount: countFolders(fileStore.rootNodes),
    assetCount: fileStore.assets?.size ?? 0,
    settingsDigest: {
      provider: aiProvider.provider ?? 'unknown',
      fontSize: appearance.fontSize ?? 'medium',
      compactMode: appearance.compactMode ?? false,
      showGrid: settingsStore.settings?.showGrid ?? true,
    },
    projectCount: projectsStore.projects?.length ?? 0,
    recentProjectCount: projectsStore.recentProjectIds?.length ?? 0,
  };
}

function countFolders(nodes: unknown[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node && typeof node === 'object' && (node as { type?: string }).type === 'folder') {
      n++;
      const children = (node as { children?: unknown[] }).children;
      if (Array.isArray(children)) n += countFolders(children);
    }
  }
  return n;
}
