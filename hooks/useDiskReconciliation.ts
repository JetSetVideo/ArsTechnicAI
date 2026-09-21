import { useEffect, useRef } from 'react';
import { useFileStore } from '@/stores/fileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';
import { useProjectsStore } from '@/stores/projectsStore';
import { saveProjectWorkspaceState } from './useProjectSync';
import type { Asset } from '@/types';
import type { Blueprint } from '@/types/blueprint';

import { useBlueprintStore } from '@/stores/blueprintStore';

interface DiskAssetMeta {
  id?: string;
  prompt?: string;
  negativePrompt?: string;
  model?: string;
  seed?: number;
  width?: number;
  height?: number;
  generatedAt?: number;
  parentIds?: string[];
  childIds?: string[];
  imageVersion?: number;
  variations?: { id: string; label: string; filePath?: string }[];
}

interface DiskAsset {
  filename: string;
  filePath: string;
  url: string;
  sizeBytes: number;
  modifiedAt: number;
  meta?: DiskAssetMeta;
}

interface ScanResult {
  assets: DiskAsset[];
  settingsOnDisk: { savedAt: number; settings: Record<string, unknown> } | null;
}

interface DiskCanvasState {
  projectId: string;
  projectName: string;
  savedAt: number;
  viewport: { x: number; y: number; zoom: number };
  items: Array<Record<string, unknown>>;
}

interface DiskLoadResult {
  canvas: DiskCanvasState | null;
  projects: { savedAt: number; projects: Array<Record<string, unknown>> } | null;
  settings: { savedAt: number; settings: Record<string, unknown> } | null;
  blueprints?: { savedAt: number; blueprints: Array<Record<string, unknown>> } | null;
  automations?: { savedAt: number; automations: Array<Record<string, unknown>> } | null;
}

/**
 * Reconciles app state from disk on startup.
 *
 * Priority chain:
 * 1. localStorage (already hydrated by zustand/persist)
 * 2. Disk files (.ars-data/ + public/generated/)
 * 3. Database (existing DB fetch code in useProjectSync)
 *
 * This hook fills in anything localStorage is missing.
 */
export function useDiskReconciliation() {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    void reconcile();
  }, []);
}

async function reconcile() {
  const projectId = useProjectStore.getState().projectId;
  const projectName = useProjectStore.getState().projectName || 'Untitled Project';

  try {
    // Run scan + load in parallel
    const [scanRes, loadRes] = await Promise.all([
      fetch('/api/workspace/scan').then((r) => (r.ok ? r.json() : null)) as Promise<ScanResult | null>,
      fetch(`/api/workspace/load?projectId=${encodeURIComponent(projectId || '')}`).then((r) =>
        r.ok ? r.json() : null,
      ) as Promise<DiskLoadResult | null>,
    ]);

    // --- Settings restoration ---
    restoreSettings(scanRes, loadRes);

    // --- Projects list restoration ---
    restoreProjectsList(loadRes);

    // Canvas restoration is retired — stores/pipelineStore.ts's own
    // loadForProject (triggered by components/workshop/WorkshopFlow.tsx on
    // mount) is now the single authoritative loader for a project's
    // Workshop state, from the same .ars-data disk files this hook used to
    // read into the now-removed canvasStore.

    // --- Reconcile generated assets from disk scan ---
    reconcileGeneratedAssets(scanRes, projectName);

    // --- Blueprint + automation restoration ---
    restoreBlueprintsFromDisk(loadRes);
    restoreAutomationsFromDisk(loadRes);

    // Cache to localStorage now that we've reconciled
    if (projectId) {
      saveProjectWorkspaceState(projectId, projectName);
    }
  } catch (err) {
    console.warn('[DiskReconciliation] Non-fatal error:', err);
  }
}

function restoreSettings(scan: ScanResult | null, load: DiskLoadResult | null) {
  const settingsStore = useSettingsStore.getState();
  const currentKey = settingsStore.settings?.aiProvider?.apiKey;

  // If we already have an API key in localStorage, skip
  if (currentKey) return;

  const diskSettings = load?.settings?.settings ?? scan?.settingsOnDisk;
  if (!diskSettings) return;

  const ai = (diskSettings as Record<string, unknown>).aiProvider as Record<string, unknown> | undefined;
  if (ai?.apiKey) {
    settingsStore.updateAIProvider(ai as Parameters<typeof settingsStore.updateAIProvider>[0]);
    console.log('[DiskReconciliation] Restored API provider settings from disk');
  }

  const appearance = (diskSettings as Record<string, unknown>).appearance as Record<string, unknown> | undefined;
  if (appearance) {
    settingsStore.updateAppearance(appearance as Parameters<typeof settingsStore.updateAppearance>[0]);
  }
}

function restoreProjectsList(load: DiskLoadResult | null) {
  const store = useProjectsStore.getState();
  if (store.projects.length > 0) return; // already have projects from localStorage

  const diskProjects = load?.projects?.projects;
  if (!Array.isArray(diskProjects) || diskProjects.length === 0) return;

  for (const dp of diskProjects) {
    const existing = store.getProject(dp.id as string);
    if (!existing) {
      useProjectsStore.setState((state) => ({
        projects: [
          ...state.projects,
          {
            id: (dp.id as string) || `proj-${Date.now()}`,
            name: (dp.name as string) || 'Untitled',
            createdAt: (dp.createdAt as number) || Date.now(),
            modifiedAt: (dp.modifiedAt as number) || Date.now(),
            assetCount: (dp.assetCount as number) || 0,
            tags: (dp.tags as string[]) || [],
            isFavorite: (dp.isFavorite as boolean) || false,
            thumbnail: dp.thumbnail as string | undefined,
          },
        ],
      }));
    }
  }
  console.log(`[DiskReconciliation] Restored ${diskProjects.length} projects from disk`);
}

function reconcileGeneratedAssets(scan: ScanResult | null, projectName: string) {
  if (!scan?.assets?.length) return;

  const fileStore = useFileStore.getState();
  const generatedPath = fileStore.getProjectGeneratedPath();
  const existingAssets = fileStore.assets;

  let added = 0;

  for (const diskAsset of scan.assets) {
    // Check if this asset is already in the file tree
    const alreadyInTree = Array.from(existingAssets.values()).some(
      (a) => a.name === diskAsset.filename || a.path?.endsWith(`/${diskAsset.filename}`),
    );
    if (alreadyInTree) continue;

    const meta = diskAsset.meta;
    const assetId = meta?.id || `disk-${diskAsset.filename}`;

    const asset: Asset = {
      id: assetId,
      name: diskAsset.filename,
      type: 'image',
      path: `${generatedPath}/${diskAsset.filename}`,
      createdAt: meta?.generatedAt || diskAsset.modifiedAt,
      modifiedAt: diskAsset.modifiedAt,
      thumbnail: diskAsset.url,
      metadata: {
        width: meta?.width,
        height: meta?.height,
        prompt: meta?.prompt,
        model: meta?.model,
        seed: meta?.seed,
      },
    };

    fileStore.addAssetToFolder(asset, generatedPath);
    // Adding orphaned disk assets straight into the Workshop pipeline is
    // deliberately NOT done here — pipelineStore.ts owns its own node list
    // authoritatively per project; auto-injecting a node on every app load
    // for any file this scan turns up would create unwanted duplicate nodes
    // over repeated sessions. Users add a file-tree asset to the pipeline
    // explicitly (double-click in the Explorer, or drag onto the canvas).
    added++;
  }

  if (added > 0) {
    console.log(`[DiskReconciliation] Reconciled ${added} assets from disk into the file tree`);
  }
}

function restoreBlueprintsFromDisk(load: DiskLoadResult | null) {
  const store = useBlueprintStore.getState();
  if (store.blueprints.length > 0) return;

  const diskBlueprints = load?.blueprints?.blueprints;
  if (!Array.isArray(diskBlueprints) || diskBlueprints.length === 0) return;

  for (const dbp of diskBlueprints) {
    const id = (dbp.id as string) || `bp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const existing = store.blueprints.find((b) => b.id === id);
    if (!existing) {
      store.addBlueprint({
        id,
        name: (dbp.name as string) || 'Untitled Blueprint',
        description: (dbp.description as string) || undefined,
        category: (dbp.category as 'image' | 'video' | 'audio' | '3d' | 'social' | 'full-pipeline') || 'image',
        nodes: Array.isArray(dbp.nodes) ? (dbp.nodes as Blueprint['nodes']) : [],
        connections: Array.isArray(dbp.connections) ? (dbp.connections as Blueprint['connections']) : [],
        parameters: Array.isArray(dbp.parameters) ? (dbp.parameters as Blueprint['parameters']) : [],
        version: (dbp.version as string) || '1.0.0',
        createdAt: (dbp.createdAt as number) || Date.now(),
        updatedAt: (dbp.updatedAt as number) || Date.now(),
        userId: (dbp.userId as string) || undefined,
        isPublic: (dbp.isPublic as boolean) || false,
      });
    }
  }
  console.log(`[DiskReconciliation] Restored ${diskBlueprints.length} blueprints from disk`);
}

function restoreAutomationsFromDisk(load: DiskLoadResult | null) {
  // Automations are stored in the blueprint store as runs for now
  // Full automation store will be added in Phase 8
  const diskAutomations = load?.automations?.automations;
  if (!Array.isArray(diskAutomations) || diskAutomations.length === 0) return;
  console.log(`[DiskReconciliation] Skipped ${diskAutomations.length} automations (Phase 8)`);
}
