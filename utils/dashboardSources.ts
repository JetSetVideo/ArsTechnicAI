import type { Asset } from '@/types';
import type { SourceReference } from '@/types/production';
import type { DashboardSourceId } from '@/types/dashboard';
import { WORKSPACE_ROOT_PATHS } from '@/constants/workspace';

export interface DashboardSourceBucket {
  id: DashboardSourceId;
  title: string;
  description: string;
  pathPrefix: string;
  assetCount: number;
  productionRefCount: number;
  thumbnail?: string;
  latestModifiedAt: number | null;
}

export const SOURCE_BUCKET_DEFS: Omit<
  DashboardSourceBucket,
  'assetCount' | 'productionRefCount' | 'thumbnail' | 'latestModifiedAt'
>[] = [
  {
    id: 'imports',
    title: 'Imports',
    description: 'Raw files from your machine — starting point before editing or generation.',
    pathPrefix: `${WORKSPACE_ROOT_PATHS.imports}/`,
  },
  {
    id: 'library',
    title: 'Reference library',
    description: 'Shared images and refs reused across projects when building pipelines.',
    pathPrefix: `${WORKSPACE_ROOT_PATHS.library}/`,
  },
  {
    id: 'prompts',
    title: 'Prompts',
    description: 'Prompt templates and variables that feed image/video generation nodes.',
    pathPrefix: `${WORKSPACE_ROOT_PATHS.prompts}/`,
  },
  {
    id: 'characters',
    title: 'Characters',
    description: 'Character looks, sheets, and consistency refs for comics and video.',
    pathPrefix: `${WORKSPACE_ROOT_PATHS.library}/characters/`,
  },
  {
    id: 'audio',
    title: 'Audio',
    description: 'Dialogue, music, SFX, and ambience for timeline assembly.',
    pathPrefix: `${WORKSPACE_ROOT_PATHS.library}/`,
  },
  {
    id: 'video',
    title: 'Video',
    description: 'Clips, plates, and motion references for storyboard and edit.',
    pathPrefix: `${WORKSPACE_ROOT_PATHS.library}/`,
  },
  {
    id: 'production_refs',
    title: 'Production refs',
    description: 'Linked URLs, notes, and documents tracked in the production pipeline.',
    pathPrefix: '',
  },
];

function assetMatchesBucket(asset: Asset, bucketId: DashboardSourceId, pathPrefix: string): boolean {
  if (bucketId === 'production_refs') return false;
  if (!asset.path.startsWith(pathPrefix)) {
    if (bucketId === 'characters') {
      return /\/character(s)?\//i.test(asset.path);
    }
    return false;
  }
  if (bucketId === 'audio') return asset.type === 'audio';
  if (bucketId === 'video') return asset.type === 'video';
  if (bucketId === 'characters') return true;
  if (bucketId === 'library') {
    const sub = asset.path.slice(pathPrefix.length);
    if (sub.startsWith('characters/')) return false;
    return asset.type === 'image' || asset.type === 'text';
  }
  if (bucketId === 'imports') return true;
  if (bucketId === 'prompts') return asset.type === 'prompt' || asset.path.startsWith(pathPrefix);
  return true;
}

export function buildSourceBuckets(
  assets: Iterable<Asset>,
  productionSources: SourceReference[]
): DashboardSourceBucket[] {
  const assetList = Array.from(assets).filter((a) => a.type !== 'folder');

  return SOURCE_BUCKET_DEFS.map((def) => {
    const matched =
      def.id === 'production_refs'
        ? []
        : assetList.filter((a) => assetMatchesBucket(a, def.id, def.pathPrefix));

    const latest = matched.length > 0 ? Math.max(...matched.map((a) => a.modifiedAt)) : null;
    const thumbAsset = matched
      .filter((a) => a.thumbnail)
      .sort((a, b) => b.modifiedAt - a.modifiedAt)[0];

    return {
      ...def,
      assetCount: def.id === 'production_refs' ? 0 : matched.length,
      productionRefCount: def.id === 'production_refs' ? productionSources.length : 0,
      thumbnail: thumbAsset?.thumbnail,
      latestModifiedAt: latest,
    };
  });
}

export function filterAssetsBySource(
  assets: Iterable<Asset>,
  sourceId: DashboardSourceId | 'all'
): Asset[] {
  if (sourceId === 'all') return Array.from(assets).filter((a) => a.type !== 'folder');
  const def = SOURCE_BUCKET_DEFS.find((d) => d.id === sourceId);
  if (!def) return [];
  return Array.from(assets).filter((a) => assetMatchesBucket(a, sourceId, def.pathPrefix));
}
