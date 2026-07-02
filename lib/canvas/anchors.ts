import { v4 as uuidv4 } from 'uuid';
import type { CanvasAnchor, CanvasAnchorKind, CanvasItem } from '@/types';

export const ANCHOR_COLORS: Record<CanvasAnchorKind, string> = {
  input: '#3b82f6',
  output: '#a855f7',
  layer: '#22c55e',
  prompt: '#f59e0b',
  variant: '#ec4899',
  link: '#00d4aa',
};

export function getAnchorColor(kind: CanvasAnchorKind): string {
  return ANCHOR_COLORS[kind] ?? ANCHOR_COLORS.link;
}

export function getDefaultAnchorsForItem(item: CanvasItem): CanvasAnchor[] {
  const anchors: CanvasAnchor[] = [
    {
      id: uuidv4(),
      itemId: item.id,
      kind: 'input',
      side: 'left',
      label: 'In',
    },
    {
      id: uuidv4(),
      itemId: item.id,
      kind: 'output',
      side: 'right',
      label: 'Out',
    },
    {
      id: uuidv4(),
      itemId: item.id,
      kind: 'link',
      side: 'bottom',
      label: 'Link',
    },
  ];

  if (item.prompt || item.promptId || item.generationMeta?.prompt) {
    anchors.push({
      id: uuidv4(),
      itemId: item.id,
      kind: 'prompt',
      side: 'bottom',
      label: 'Prompt',
    });
  }

  if (item.generationMeta?.parentIds?.length || item.generationMeta?.childIds?.length || item.layerRole === 'variant') {
    anchors.push({
      id: uuidv4(),
      itemId: item.id,
      kind: 'variant',
      side: 'right',
      offsetY: 12,
      label: 'Variant',
    });
  }

  return anchors;
}

export function getAnchorCanvasPosition(
  item: CanvasItem,
  anchor: CanvasAnchor,
): { x: number; y: number } {
  const w = item.width * item.scale;
  const h = item.height * item.scale;
  const ox = anchor.offsetX ?? 0;
  const oy = anchor.offsetY ?? 0;

  switch (anchor.side) {
    case 'top':
      return { x: item.x + w / 2 + ox, y: item.y + oy };
    case 'bottom':
      return { x: item.x + w / 2 + ox, y: item.y + h + oy };
    case 'left':
      return { x: item.x + ox, y: item.y + h / 2 + oy };
    case 'right':
      return { x: item.x + w + ox, y: item.y + h / 2 + oy };
    case 'center':
    default:
      return { x: item.x + w / 2 + ox, y: item.y + h / 2 + oy };
  }
}
