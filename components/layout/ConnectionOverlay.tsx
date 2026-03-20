import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCanvasStore } from '@/stores';

interface Endpoint {
  cx: number;
  cy: number;
}

interface LinkPair {
  id: string;
  canvas: Endpoint;
  clip: Endpoint;
}

export const ConnectionOverlay: React.FC<{
  containerRef: React.RefObject<HTMLDivElement | null>;
}> = ({ containerRef }) => {
  const items = useCanvasStore((s) => s.items);
  const viewport = useCanvasStore((s) => s.viewport);
  const [links, setLinks] = useState<LinkPair[]>([]);
  const rafRef = useRef(0);
  const tickRef = useRef(0);

  const compute = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    const visualItems = items.filter(
      (i) => i.type === 'image' || i.type === 'generated',
    );

    if (visualItems.length === 0) {
      setLinks([]);
      return;
    }

    const nextLinks: LinkPair[] = [];

    for (const item of visualItems) {
      const canvasEl = container.querySelector<HTMLElement>(
        `[data-canvas-item-id="${item.id}"]`,
      );
      const clipEl = container.querySelector<HTMLElement>(
        `[data-item-id="${item.id}"]`,
      );

      if (!canvasEl || !clipEl) continue;

      const cRect = canvasEl.getBoundingClientRect();
      const tRect = clipEl.getBoundingClientRect();

      nextLinks.push({
        id: item.id,
        canvas: {
          cx: cRect.left + cRect.width / 2 - containerRect.left,
          cy: cRect.top + cRect.height - containerRect.top,
        },
        clip: {
          cx: tRect.left + tRect.width / 2 - containerRect.left,
          cy: tRect.top - containerRect.top,
        },
      });
    }

    setLinks(nextLinks);
  }, [items, containerRef, viewport]);

  useEffect(() => {
    let running = true;

    const tick = () => {
      if (!running) return;
      compute();
      tickRef.current++;
      // Throttle: recompute every ~3 frames (~50ms at 60fps)
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = requestAnimationFrame(tick);
        });
      });
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [compute]);

  if (links.length === 0) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 50,
        overflow: 'visible',
      }}
    >
      <defs>
        <linearGradient id="cord-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.50" />
          <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      {links.map((link) => {
        const { canvas: c, clip: t } = link;
        const dy = t.cy - c.cy;
        const cpOffset = Math.max(40, Math.abs(dy) * 0.4);

        const d = `M ${c.cx} ${c.cy} C ${c.cx} ${c.cy + cpOffset}, ${t.cx} ${t.cy - cpOffset}, ${t.cx} ${t.cy}`;

        return (
          <g key={link.id}>
            <path
              d={d}
              fill="none"
              stroke="var(--accent-primary)"
              strokeWidth={4}
              strokeOpacity={0.06}
              strokeLinecap="round"
            />
            <path
              d={d}
              fill="none"
              stroke="url(#cord-grad)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeDasharray="6 4"
            />
            <circle cx={c.cx} cy={c.cy} r={3} fill="var(--accent-primary)" fillOpacity={0.5} />
            <circle cx={t.cx} cy={t.cy} r={3} fill="var(--accent-primary)" fillOpacity={0.5} />
          </g>
        );
      })}
    </svg>
  );
};
