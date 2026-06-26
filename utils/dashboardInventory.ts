import type { Asset } from '@/types';
import type { DashboardProject } from '@/types/dashboard';
import type {
  DashboardAssetCategory,
  DashboardAssetLink,
  DashboardInventoryItem,
} from '@/types/dashboard';
import { WORKSPACE_ROOT_PATHS } from '@/constants/workspace';
import { slugifyProjectName } from '@/utils/project';
import type { DashboardSourceId } from '@/types/dashboard';
import { filterAssetsBySource } from '@/utils/dashboardSources';

const CATEGORY_PATH_HINTS: Record<Exclude<DashboardAssetCategory, 'all' | 'other'>, string[]> = {
  image: [],
  video: [],
  audio: [],
  prompt: ['/prompts'],
  text: [],
  character: ['/characters', '/character'],
  subtitle: ['/subtitles', '/captions'],
  scene: ['/scenes', '/scene'],
  preset: ['/presets', '/preset'],
};

export function categorizeAsset(asset: Asset): DashboardAssetCategory {
  const pathLower = asset.path.toLowerCase();
  const nameLower = asset.name.toLowerCase();

  if (asset.type === 'prompt') return 'prompt';

  for (const [category, hints] of Object.entries(CATEGORY_PATH_HINTS) as [
    Exclude<DashboardAssetCategory, 'all' | 'other'>,
    string[],
  ][]) {
    if (hints.some((h) => pathLower.includes(h))) return category;
  }

  if (nameLower.endsWith('.srt') || nameLower.endsWith('.vtt') || nameLower.includes('subtitle')) {
    return 'subtitle';
  }

  if (asset.type === 'image' || asset.type === 'video' || asset.type === 'audio' || asset.type === 'text') {
    return asset.type;
  }

  return 'other';
}

function projectSlugFromPath(path: string): string | null {
  const prefix = `${WORKSPACE_ROOT_PATHS.projects}/`;
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length);
  return rest.split('/')[0] || null;
}

function resolveProjectIds(
  asset: Asset,
  scope: 'library' | string,
  projects: DashboardProject[]
): string[] {
  if (scope === 'library') {
    return projects.map((p) => p.id);
  }
  const slug = scope;
  const match = projects.find((p) => slugifyProjectName(p.name) === slug);
  return match ? [match.id] : [];
}

function buildLinks(asset: Asset, assetsById: Map<string, Asset>): DashboardAssetLink[] {
  const links: DashboardAssetLink[] = [];
  const meta = asset.metadata;

  if (meta?.parentAssetId && assetsById.has(meta.parentAssetId)) {
    links.push({
      kind: 'parent',
      targetAssetId: meta.parentAssetId,
      label: assetsById.get(meta.parentAssetId)?.name,
    });
  }
  if (meta?.lineageId) {
    const lineageSibling = Array.from(assetsById.values()).find(
      (a) => a.id !== asset.id && a.metadata?.lineageId === meta.lineageId
    );
    if (lineageSibling) {
      links.push({
        kind: 'lineage',
        targetAssetId: lineageSibling.id,
        label: lineageSibling.name,
      });
    }
  }
  if (meta?.promptId && assetsById.has(meta.promptId)) {
    links.push({
      kind: 'prompt',
      targetAssetId: meta.promptId,
      label: assetsById.get(meta.promptId)?.name,
    });
  }

  return links;
}

export function buildAssetInventory(
  assets: Iterable<Asset>,
  projects: DashboardProject[],
  sourceScope: DashboardSourceId | 'all' = 'all'
): DashboardInventoryItem[] {
  const assetList = filterAssetsBySource(assets, sourceScope);
  const assetsById = new Map(assetList.map((a) => [a.id, a]));

  return assetList.map((asset) => {
    const libraryPrefix = `${WORKSPACE_ROOT_PATHS.library}/`;
    const isLibrary = asset.path.startsWith(libraryPrefix);
    const projectSlug = projectSlugFromPath(asset.path);
    const scope: 'library' | string = isLibrary ? 'library' : projectSlug ?? 'unknown';

    return {
      assetId: asset.id,
      name: asset.name,
      category: categorizeAsset(asset),
      path: asset.path,
      modifiedAt: asset.modifiedAt,
      thumbnail: asset.thumbnail,
      scope,
      projectIds: resolveProjectIds(asset, scope, projects),
      links: buildLinks(asset, assetsById),
    };
  });
}

export function filterInventory(
  items: DashboardInventoryItem[],
  category: DashboardAssetCategory,
  projectScope: string,
  _sourceScope: DashboardSourceId | 'all' = 'all'
): DashboardInventoryItem[] {
  let filtered = items;

  if (category !== 'all') {
    filtered = filtered.filter((item) => item.category === category);
  }

  if (projectScope === 'library') {
    filtered = filtered.filter((item) => item.scope === 'library');
  } else if (projectScope !== 'all') {
    filtered = filtered.filter((item) => item.projectIds.includes(projectScope));
  }

  return filtered.sort((a, b) => b.modifiedAt - a.modifiedAt);
}
