import type { Asset } from '@/types';
import { slugifyProjectName } from '@/utils/project';

/** A picture that actually sits on a project's canvas. */
export interface CanvasPicture {
  nodeId: string;
  nodeTitle: string;
  variantId: string;
  name: string;
  src: string;
  updatedAt: number;
}

export interface CanvasProjectPictures {
  projectId: string;
  projectName: string;
  updatedAt: number;
  pictures: CanvasPicture[];
}

interface PictureVariant {
  id: string;
  label?: string;
  image?: string;
  updatedAt?: number;
  createdAt?: number;
}

interface PictureNode {
  id: string;
  title?: string;
  params?: Record<string, unknown>;
  variants?: PictureVariant[];
}

const PICTURE_EXT = /\.(png|jpe?g|webp|gif|bmp|svg|avif|mp4|webm|mov)$/i;

export function isPictureSrc(src: string): boolean {
  if (src.startsWith('data:image/') || src.startsWith('data:video/')) return true;
  return PICTURE_EXT.test(src.split('?')[0]);
}

function fileName(src: string): string {
  if (!src.startsWith('/') && !src.startsWith('http')) return '';
  return src.split('/').pop()?.split('?')[0] || '';
}

/** Every image or video a node is holding, active variant first. */
export function picturesFromNodes(nodes: PictureNode[]): CanvasPicture[] {
  const pictures: CanvasPicture[] = [];
  const seen = new Set<string>();
  const add = (picture: CanvasPicture) => {
    if (!picture.src || seen.has(picture.src)) return;
    seen.add(picture.src);
    pictures.push(picture);
  };

  for (const node of nodes) {
    const title = node.title || 'Untitled';
    for (const variant of node.variants || []) {
      const src = variant.image || '';
      if (!isPictureSrc(src)) continue;
      add({
        nodeId: node.id,
        nodeTitle: title,
        variantId: variant.id,
        name: fileName(src) || variant.label || title,
        src,
        updatedAt: variant.updatedAt || variant.createdAt || 0,
      });
    }
    const file = node.params?.file;
    if (typeof file === 'string' && isPictureSrc(file)) {
      add({
        nodeId: node.id,
        nodeTitle: title,
        variantId: 'file',
        name: fileName(file) || title,
        src: file,
        updatedAt: 0,
      });
    }
  }
  return pictures;
}

/**
 * The card shows a canvas picture. A stored cover is kept only when that
 * exact image is still on the canvas.
 */
export function displayCover(stored: string | undefined, pictures: CanvasPicture[]): string | undefined {
  if (stored && pictures.some((picture) => picture.src === stored)) return stored;
  const newest = pictures.reduce<CanvasPicture | undefined>((best, picture) => (
    !best || picture.updatedAt >= best.updatedAt ? picture : best
  ), undefined);
  return newest?.src || stored;
}

export interface AssetPlace {
  label: string;
  detail: string;
}

/** Where a library file lives: Generated, Imports, the canvas, and so on. */
export function placeFromPath(path: string): AssetPlace {
  const parts = path.split('/').filter(Boolean);
  const titled = (part: string) => part ? part.charAt(0).toUpperCase() + part.slice(1) : 'Files';
  if (parts[0] === 'projects') {
    return { label: titled(parts[2] || 'project'), detail: parts[1] || '' };
  }
  if (parts[0] === 'generated' || parts[0] === 'imports' || parts[0] === 'library' || parts[0] === 'prompts' || parts[0] === 'exports') {
    return { label: titled(parts[0]), detail: parts[1] && parts[0] === 'library' ? parts[1] : '' };
  }
  if (parts.length >= 2) return { label: titled(parts[parts.length - 2]), detail: '' };
  return { label: 'Library', detail: '' };
}

export type PlacedAsset = Asset & { placeLabel: string; placeDetail: string };

function projectNameForPath(path: string, projects: { id: string; name: string }[]): string {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'projects' || !parts[1]) return '';
  const match = projects.find((project) => slugifyProjectName(project.name) === parts[1]);
  return match?.name || '';
}

const GENERIC_VERSION = /^v\d+$/i;

function isVideo(src: string): boolean {
  return src.startsWith('data:video/') || /\.(mp4|webm|mov)$/i.test(src);
}

/** One card per node. Versions of that node stay together instead of each being named "v1". */
function groupedCanvasAssets(canvas: CanvasProjectPictures, live: boolean): PlacedAsset[] {
  const byNode = new Map<string, CanvasPicture[]>();
  for (const picture of canvas.pictures) {
    const list = byNode.get(picture.nodeId) ?? [];
    list.push(picture);
    byNode.set(picture.nodeId, list);
  }
  const assets: PlacedAsset[] = [];
  for (const pictures of byNode.values()) {
    const sorted = [...pictures].sort((a, b) => b.updatedAt - a.updatedAt);
    const lead = sorted[0];
    const generic = sorted.every((picture) => GENERIC_VERSION.test(picture.name) || picture.name === lead.nodeTitle);
    assets.push({
      id: `canvas:${canvas.projectId}:${lead.nodeId}`,
      name: generic ? lead.nodeTitle : lead.name,
      type: isVideo(lead.src) ? 'video' : 'image',
      path: live
        ? `canvas://${canvas.projectId}/${lead.nodeId}`
        : `/unassigned/${canvas.projectId}/${lead.nodeId}`,
      createdAt: lead.updatedAt,
      modifiedAt: lead.updatedAt,
      thumbnail: lead.src,
      placeLabel: live ? 'Canvas' : 'No project',
      placeDetail: live ? canvas.projectName : 'Not on a current project',
      metadata: {
        source: live ? 'generated' : undefined,
        projectIds: live ? [canvas.projectId] : [],
        variationIds: sorted.map((picture) => picture.variantId),
        prompt: lead.nodeTitle,
      },
    });
  }
  return assets;
}

function alreadyListed(assets: PlacedAsset[], picture: CanvasPicture): boolean {
  const fromSrc = fileName(picture.src);
  const fromName = PICTURE_EXT.test(picture.name) ? picture.name : '';
  const named = fromSrc || fromName;
  return assets.some((asset) => (
    asset.thumbnail === picture.src
    || asset.path === picture.src
    || (named !== '' && (asset.name === named || asset.path.endsWith(`/${named}`)))
  ));
}

/** Folder files, plus every canvas picture that is not already one of those files. */
export function buildLibrary(
  assets: Iterable<Asset>,
  canvases: CanvasProjectPictures[],
  projects: { id: string; name: string }[] = [],
): PlacedAsset[] {
  const listed: PlacedAsset[] = [];
  for (const asset of assets) {
    const place = placeFromPath(asset.path || '');
    const projectName = projectNameForPath(asset.path || '', projects);
    const orphanFolder = (asset.path || '').startsWith('/projects/') && !projectName;
    listed.push({
      ...asset,
      placeLabel: place.label,
      placeDetail: orphanFolder ? 'Not on a current project' : (projectName || place.detail),
    });
  }
  const liveIds = new Set(projects.map((project) => project.id));
  for (const canvas of canvases) {
    const live = liveIds.has(canvas.projectId);
    for (const asset of groupedCanvasAssets(canvas, live)) {
      const pictures = canvas.pictures.filter((picture) => picture.nodeId === asset.id.split(':').pop());
      if (pictures.some((picture) => alreadyListed(listed, picture))) continue;
      listed.push(asset);
    }
  }
  return listed;
}

/** Files in this project's folders, plus pictures on its canvas. */
export function entriesForProject(
  projectId: string,
  projectName: string,
  assets: Iterable<Asset>,
  pictures: CanvasPicture[],
): PlacedAsset[] {
  const prefix = `/projects/${slugifyProjectName(projectName)}/`;
  const folder = buildLibrary(
    Array.from(assets).filter((asset) => (asset.path || '').startsWith(prefix)),
    [],
    [{ id: projectId, name: projectName }],
  );
  for (const asset of groupedCanvasAssets({ projectId, projectName, updatedAt: 0, pictures }, true)) {
    const nodeId = asset.id.split(':').pop();
    const group = pictures.filter((picture) => picture.nodeId === nodeId);
    if (group.some((picture) => alreadyListed(folder, picture))) continue;
    folder.push(asset);
  }
  return folder;
}
