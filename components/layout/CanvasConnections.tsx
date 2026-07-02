import React, { useMemo } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { getAnchorCanvasPosition } from '@/lib/canvas/anchors';
import type { CanvasAnchor } from '@/types';
import styles from './Canvas.module.css';

function anchorBezierPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromAnchor?: CanvasAnchor,
  toAnchor?: CanvasAnchor,
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const base = Math.max(60, dist * 0.4);

  const fromSide = fromAnchor?.side ?? 'right';
  const toSide = toAnchor?.side ?? 'left';

  const cp1 = { x: from.x, y: from.y };
  const cp2 = { x: to.x, y: to.y };

  if (fromSide === 'right')       { cp1.x += base; }
  else if (fromSide === 'left')   { cp1.x -= base; }
  else if (fromSide === 'bottom') { cp1.y += base; }
  else if (fromSide === 'top')    { cp1.y -= base; }

  if (toSide === 'left')          { cp2.x -= base; }
  else if (toSide === 'right')    { cp2.x += base; }
  else if (toSide === 'top')      { cp2.y -= base; }
  else if (toSide === 'bottom')   { cp2.y += base; }

  return `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${to.x} ${to.y}`;
}

interface CanvasConnectionsProps {
  zoom: number;
  svgW: number;
  svgH: number;
  connectionPreviewEnd?: { x: number; y: number } | null;
}

export const CanvasConnections: React.FC<CanvasConnectionsProps> = ({
  zoom,
  svgW,
  svgH,
  connectionPreviewEnd,
}) => {
  const items = useCanvasStore((s) => s.items);
  const connections = useCanvasStore((s) => s.connections);
  const anchors = useCanvasStore((s) => s.anchors);
  const pendingConnection = useCanvasStore((s) => s.pendingConnection);
  const removeConnection = useCanvasStore((s) => s.removeConnection);

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const anchorMap = useMemo(() => new Map(anchors.map((a) => [a.id, a])), [anchors]);

  const anchorPositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const anchor of anchors) {
      const item = itemMap.get(anchor.itemId);
      if (item) map.set(anchor.id, getAnchorCanvasPosition(item, anchor));
    }
    return map;
  }, [anchors, itemMap]);

  const previewFrom = pendingConnection?.anchorId
    ? anchorPositions.get(pendingConnection.anchorId)
    : undefined;

  return (
    <svg
      className={styles.canvasConnSvg}
      width={svgW}
      height={svgH}
      style={{ left: -svgW / 2, top: -svgH / 2, position: 'absolute', overflow: 'visible', zIndex: 6 }}
    >
      <g transform={`translate(${svgW / 2}, ${svgH / 2})`}>
        {connections.map((conn) => {
          const from = conn.sourceAnchorId ? anchorPositions.get(conn.sourceAnchorId) : undefined;
          const to = conn.targetAnchorId ? anchorPositions.get(conn.targetAnchorId) : undefined;
          if (!from || !to) return null;
          const fromAnchor = conn.sourceAnchorId ? anchorMap.get(conn.sourceAnchorId) : undefined;
          const toAnchor = conn.targetAnchorId ? anchorMap.get(conn.targetAnchorId) : undefined;
          const d = anchorBezierPath(from, to, fromAnchor, toAnchor);
          return (
            <g key={conn.id} style={{ pointerEvents: 'auto' }}>
              <path
                d={d}
                stroke={conn.color}
                strokeWidth={2.5 / zoom}
                fill="none"
                opacity={0.85}
                className={styles.connTrail}
              />
              <path
                d={d}
                stroke="transparent"
                strokeWidth={14 / zoom}
                fill="none"
                style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                onClick={() => removeConnection(conn.id)}
              />
            </g>
          );
        })}

        {previewFrom && connectionPreviewEnd && pendingConnection && (() => {
          const fromAnchor = pendingConnection.anchorId ? anchorMap.get(pendingConnection.anchorId) : undefined;
          const previewD = anchorBezierPath(previewFrom, connectionPreviewEnd, fromAnchor);
          return (
            <path
              d={previewD}
              stroke={pendingConnection.color}
              strokeWidth={2 / zoom}
              strokeDasharray={`${6 / zoom} ${4 / zoom}`}
              fill="none"
              opacity={0.75}
              className={styles.connPreview}
            />
          );
        })()}
      </g>
    </svg>
  );
};
