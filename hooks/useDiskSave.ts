import { useCanvasStore } from '@/stores/canvasStore';
import { useFileStore } from '@/stores/fileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';
import { useProjectsStore } from '@/stores/projectsStore';

// Dirty-check: skip the network round-trip (and the server-side write it
// triggers) entirely when nothing has changed since the last successful
// call — this function used to be fired unconditionally on a 15s interval
// regardless of activity.
let _lastSentPayload: string | null = null;

/**
 * Saves all workspace state to disk via the /api/workspace/save endpoint.
 * Call this alongside localStorage saves so data survives browser wipes.
 */
export async function saveToDisk(): Promise<boolean> {
  try {
    const projectId = useProjectStore.getState().projectId;
    const projectName = useProjectStore.getState().projectName || 'Untitled Project';
    const { items, viewport } = useCanvasStore.getState();
    const settings = useSettingsStore.getState().settings;
    const projects = useProjectsStore.getState().projects;
    const fileState = useFileStore.getState().exportProjectFileState(projectName);

    const body = JSON.stringify({
      projectId,
      projectName,
      canvas: {
        viewport,
        items: items.map((item) => ({
          ...item,
          dataUrl: item.src,
        })),
      },
      fileState: {
        projectPath: fileState.projectPath,
        selectedPath: fileState.selectedPath,
        expandedPaths: fileState.expandedPaths,
        projectAssets: fileState.projectAssets,
      },
      settings,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        createdAt: p.createdAt,
        modifiedAt: p.modifiedAt,
        assetCount: p.assetCount,
        tags: p.tags,
        isFavorite: p.isFavorite,
        thumbnail: p.thumbnail,
      })),
    });

    if (body === _lastSentPayload) return true; // nothing changed — skip the request

    await fetch('/api/workspace/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    _lastSentPayload = body;

    return true;
  } catch (err) {
    console.warn('[DiskSave] Non-fatal:', err);
    return false;
  }
}
