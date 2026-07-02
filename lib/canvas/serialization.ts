import type {
  CanvasAnchor,
  CanvasConnection,
  CanvasGroup,
  CanvasItem,
} from '@/types';

export function serializeCanvasItem(item: CanvasItem) {
  return {
    id: item.id,
    type: item.type.toUpperCase(),
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    scale: item.scale,
    zIndex: item.zIndex,
    visible: item.visible,
    locked: item.locked,
    name: item.name,
    dataUrl: item.src ?? null,
    prompt: item.prompt ?? null,
    assetId: item.assetId ?? null,
    promptId: item.promptId ?? null,
    lineageId: item.lineageId ?? null,
    parentAssetId: item.parentAssetId ?? null,
    parentItemId: item.parentItemId ?? null,
    layerRole: item.layerRole ?? null,
    layerOffset: item.layerOffset ?? null,
    etiquettePosition: item.etiquettePosition ?? null,
    connectionIds: item.connectionIds ?? [],
    timelineRole: item.timelineRole ?? null,
    sceneId: item.sceneId ?? null,
    stackOrder: item.stackOrder ?? null,
    overlayKind: item.overlayKind ?? null,
    groupId: item.groupId ?? null,
    groupOrbit: item.groupOrbit ?? null,
    version: item.version ?? null,
    nodeData: item.generationMeta ? JSON.parse(JSON.stringify(item.generationMeta)) : null,
    mediaMeta: item.mediaMeta ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt ?? null,
  };
}

export function deserializeCanvasItem(raw: Record<string, unknown>): Omit<CanvasItem, 'id' | 'createdAt' | 'zIndex'> & {
  id?: string;
  createdAt?: number;
  zIndex?: number;
} {
  const typeRaw = String(raw.type ?? 'image').toLowerCase();
  const validTypes = ['image', 'generated', 'placeholder', 'video', 'audio', 'text', 'template', 'shape', 'drawing'] as const;
  const type = validTypes.includes(typeRaw as typeof validTypes[number])
    ? (typeRaw as CanvasItem['type'])
    : 'image';

  const restoredMeta =
    raw.generationMeta && typeof raw.generationMeta === 'object'
      ? raw.generationMeta
      : raw.nodeData && typeof raw.nodeData === 'object'
        ? raw.nodeData
        : undefined;

  return {
    id: raw.id as string | undefined,
    assetId: (raw.assetId as string) ?? undefined,
    type,
    x: (raw.x as number) ?? 0,
    y: (raw.y as number) ?? 0,
    width: (raw.width as number) ?? 512,
    height: (raw.height as number) ?? 512,
    rotation: (raw.rotation as number) ?? 0,
    scale: (raw.scale as number) ?? (raw.scaleX as number) ?? 1,
    zIndex: (raw.zIndex as number) ?? undefined,
    locked: (raw.locked as boolean) ?? false,
    visible: (raw.visible as boolean) ?? true,
    src: (raw.dataUrl as string) ?? (raw.src as string) ?? '',
    name: (raw.name as string) ?? 'Untitled',
    prompt: (raw.prompt as string) ?? undefined,
    promptId: (raw.promptId as string) ?? undefined,
    lineageId: (raw.lineageId as string) ?? undefined,
    version: (raw.version as string) ?? undefined,
    parentAssetId: (raw.parentAssetId as string) ?? undefined,
    parentItemId: (raw.parentItemId as string) ?? undefined,
    layerRole: (raw.layerRole as CanvasItem['layerRole']) ?? undefined,
    layerOffset: (raw.layerOffset as CanvasItem['layerOffset']) ?? undefined,
    etiquettePosition: (raw.etiquettePosition as CanvasItem['etiquettePosition']) ?? undefined,
    connectionIds: (raw.connectionIds as string[]) ?? [],
    timelineRole: (raw.timelineRole as CanvasItem['timelineRole']) ?? undefined,
    sceneId: (raw.sceneId as string) ?? undefined,
    stackOrder: (raw.stackOrder as number) ?? undefined,
    overlayKind: (raw.overlayKind as CanvasItem['overlayKind']) ?? undefined,
    groupId: (raw.groupId as string) ?? undefined,
    groupOrbit: (raw.groupOrbit as boolean) ?? undefined,
    createdAt: (raw.createdAt as number) ?? undefined,
    updatedAt: (raw.updatedAt as number) ?? undefined,
    generationMeta: restoredMeta as CanvasItem['generationMeta'],
    mediaMeta: (raw.mediaMeta as CanvasItem['mediaMeta']) ?? undefined,
  };
}

export function serializeCanvasGraph(
  groups: CanvasGroup[],
  connections: CanvasConnection[],
  anchors: CanvasAnchor[],
) {
  return { groups, connections, anchors };
}
