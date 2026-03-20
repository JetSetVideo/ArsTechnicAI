import { useEffect, useRef } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useFileStore } from '@/stores/fileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';
import { useProjectsStore } from '@/stores/projectsStore';
import { saveProjectWorkspaceState } from './useProjectSync';
import type { GenerationMeta, Asset } from '@/types';

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

    // --- Canvas + file tree restoration ---
    if (projectId) {
      restoreCanvasFromDisk(loadRes, projectId, projectName);
    }

    // --- Reconcile generated assets from disk scan ---
    reconcileGeneratedAssets(scanRes, projectName);

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

function restoreCanvasFromDisk(load: DiskLoadResult | null, projectId: string, projectName: string) {
  const canvasStore = useCanvasStore.getState();
  if (canvasStore.items.length > 0) return; // already has items from localStorage

  const diskCanvas = load?.canvas;
  if (!diskCanvas?.items?.length) return;

  if (diskCanvas.viewport) {
    canvasStore.setViewport(diskCanvas.viewport);
  }

  canvasStore.clearCanvas();
  for (const item of diskCanvas.items) {
    const restoredMeta: GenerationMeta | undefined =
      item.generationMeta && typeof item.generationMeta === 'object'
        ? (item.generationMeta as GenerationMeta)
        : item.nodeData && typeof item.nodeData === 'object'
          ? (item.nodeData as GenerationMeta)
          : undefined;

    canvasStore.addItem({
      type: ((item.type as string)?.toLowerCase?.() ?? 'image') as 'image' | 'generated' | 'placeholder',
      x: (item.x as number) ?? 0,
      y: (item.y as number) ?? 0,
      width: (item.width as number) ?? 512,
      height: (item.height as number) ?? 512,
      rotation: (item.rotation as number) ?? 0,
      scale: (item.scale as number) ?? 1,
      locked: (item.locked as boolean) ?? false,
      visible: (item.visible as boolean) ?? true,
      src: (item.src as string) ?? (item.dataUrl as string) ?? '',
      name: (item.name as string) ?? 'Untitled',
      prompt: item.prompt as string | undefined,
      assetId: item.assetId as string | undefined,
      generationMeta: restoredMeta,
    });
  }

  // Rebuild file tree
  const fileStore = useFileStore.getState();
  const generatedPath = fileStore.getProjectGeneratedPath();
  for (const item of diskCanvas.items) {
    if ((item.type as string)?.toLowerCase() === 'generated' && item.name) {
      fileStore.addAssetToFolder(
        {
          id: (item.assetId as string) || (item.id as string) || Date.now().toString(),
          name: item.name as string,
          type: 'image',
          path: `${generatedPath}/${item.name}`,
          createdAt: (item.createdAt as number) || Date.now(),
          modifiedAt: Date.now(),
          thumbnail: (item.src as string) || (item.dataUrl as string) || '',
          metadata: {
            width: item.width as number,
            height: item.height as number,
            prompt: item.prompt as string,
          },
        },
        generatedPath,
      );
    }
  }

  console.log(`[DiskReconciliation] Restored ${diskCanvas.items.length} canvas items from disk`);
}

function reconcileGeneratedAssets(scan: ScanResult | null, projectName: string) {
  if (!scan?.assets?.length) return;

  const fileStore = useFileStore.getState();
  const generatedPath = fileStore.getProjectGeneratedPath();
  const existingAssets = fileStore.assets;
  const canvasStore = useCanvasStore.getState();

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

    // Also add to canvas if not already there
    const alreadyOnCanvas = canvasStore.items.some(
      (item) => item.name === diskAsset.filename,
    );

    if (!alreadyOnCanvas) {
      const existingCount = canvasStore.items.length;
      canvasStore.addItem({
        type: 'generated',
        x: 100 + existingCount * 40,
        y: 100 + existingCount * 40,
        width: meta?.width || 512,
        height: meta?.height || 512,
        rotation: 0,
        scale: 1,
        locked: false,
        visible: true,
        src: diskAsset.url,
        name: diskAsset.filename,
        prompt: meta?.prompt,
        assetId,
        generationMeta: meta
          ? {
              id: meta.id || assetId,
              prompt: meta.prompt || '',
              negativePrompt: meta.negativePrompt,
              model: meta.model || 'unknown',
              seed: meta.seed || 0,
              width: meta.width || 512,
              height: meta.height || 512,
              generatedAt: meta.generatedAt || diskAsset.modifiedAt,
              filePath: diskAsset.filePath,
              parentIds: meta.parentIds || [],
              childIds: meta.childIds || [],
              imageVersion: meta.imageVersion || 1,
              variations: meta.variations || [],
            }
          : undefined,
      });
    }

    added++;
  }

  if (added > 0) {
    console.log(`[DiskReconciliation] Reconciled ${added} assets from disk into file tree + canvas`);
  }
}
