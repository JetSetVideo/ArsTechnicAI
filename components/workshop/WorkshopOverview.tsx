import React, { useEffect, useMemo, useState } from 'react';
import { useSettingsStore } from '@/stores';
import { STAGES, STAGE_ORDER } from '@/lib/pipeline/catalog';
import { usePipelineStore, nodePosition, NODE_W, NODE_H, LANE_WIDTH } from '@/stores/pipelineStore';
import type { PipelineNode, PipelineViewport, SceneRef } from '@/types/pipeline';
import styles from './WorkshopFlow.module.css';

interface WorkshopOverviewProps {
  nodes: PipelineNode[];
  scenes: SceneRef[];
  viewport: PipelineViewport;
  setViewport: (viewport: PipelineViewport) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

function activeImage(node: PipelineNode): string | undefined {
  const variant = node.variants.find((item) => item.id === node.activeVariantId) ?? node.variants[node.variants.length - 1];
  return variant?.image;
}

/** The picture the pipeline would show if you pressed play: last film frame, else the rightmost pictured node. */
function outputImage(nodes: PipelineNode[], scenes: SceneRef[]): string | undefined {
  for (let i = scenes.length - 1; i >= 0; i -= 1) {
    const scene = scenes[i];
    const node = nodes.find((item) => item.id === scene.nodeId);
    const variant = node?.variants.find((item) => item.id === scene.variantId) ?? node?.variants[0];
    if (variant?.image) return variant.image;
  }
  const pictured = nodes
    .map((node) => ({ node, image: activeImage(node) }))
    .filter((item): item is { node: PipelineNode; image: string } => !!item.image);
  pictured.sort((a, b) => {
    const stage = STAGE_ORDER.indexOf(a.node.stage) - STAGE_ORDER.indexOf(b.node.stage);
    if (stage !== 0) return stage;
    return a.node.slot - b.node.slot;
  });
  return pictured[pictured.length - 1]?.image;
}

export const WorkshopOverview: React.FC<WorkshopOverviewProps> = ({
  nodes, scenes, viewport, setViewport, canvasRef,
}) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const mapWidth = useSettingsStore((s) => s.settings.appearance.mapWidth ?? 148);
  const mapHeight = useSettingsStore((s) => s.settings.appearance.mapHeight ?? 78);
  const mapOpacity = useSettingsStore((s) => s.settings.appearance.mapOpacity ?? 0.42);
  const mapVisible = useSettingsStore((s) => s.settings.appearance.mapVisible ?? true);
  const resultBackdrop = useSettingsStore((s) => s.settings.appearance.resultBackdrop ?? true);
  const cookedId = usePipelineStore((s) => s.lastCookedNodeId);
  const picture = useMemo(() => {
    if (cookedId) {
      const cooked = nodes.find((node) => node.id === cookedId);
      const image = cooked ? activeImage(cooked) : undefined;
      if (image) return image;
    }
    return outputImage(nodes, scenes);
  }, [nodes, scenes, cookedId]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [canvasRef]);

  const layout = useMemo(() => {
    if (nodes.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const marks = nodes.map((node) => {
      const pos = nodePosition(node);
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + NODE_W);
      maxY = Math.max(maxY, pos.y + NODE_H);
      return { id: node.id, x: pos.x, y: pos.y, color: STAGES[node.stage].color, lane: pos.x };
    });
    const pad = 80;
    minX -= pad;
    minY -= pad;
    maxX += pad + LANE_WIDTH * 0.1;
    maxY += pad;
    const worldW = Math.max(1, maxX - minX);
    const worldH = Math.max(1, maxY - minY);
    const mapW = Math.max(72, Math.min(280, mapWidth));
    const mapH = Math.max(40, Math.min(160, mapHeight));
    const scale = Math.min(mapW / worldW, mapH / worldH);
    const ox = (mapW - worldW * scale) / 2;
    const oy = (mapH - worldH * scale) / 2;
    const view = {
      x: (-viewport.x / viewport.zoom - minX) * scale + ox,
      y: (-viewport.y / viewport.zoom - minY) * scale + oy,
      w: (size.width / viewport.zoom) * scale,
      h: (size.height / viewport.zoom) * scale,
    };
    return { marks, minX, minY, scale, ox, oy, mapW, mapH, view };
  }, [nodes, viewport, size, mapWidth, mapHeight]);

  const panTo = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!layout || size.width === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const worldX = layout.minX + (event.clientX - rect.left - layout.ox) / layout.scale;
    const worldY = layout.minY + (event.clientY - rect.top - layout.oy) / layout.scale;
    setViewport({
      zoom: viewport.zoom,
      x: size.width / 2 - worldX * viewport.zoom,
      y: size.height / 2 - worldY * viewport.zoom,
    });
  };

  return (
    <>
      {resultBackdrop && (
        <div className={styles.outputBackdrop} aria-hidden={!picture}>
          {picture ? (
            <img src={picture} alt="" />
          ) : (
            <div className={styles.outputEmpty}>Run a node to place its picture behind the graph.</div>
          )}
        </div>
      )}
      {layout && mapVisible && (
        <div
          className={styles.minimap}
          style={{ width: layout.mapW, height: layout.mapH, opacity: Math.max(0.15, Math.min(1, mapOpacity)) }}
          onPointerDown={panTo}
          title="Pipeline map — the rectangle is this window"
        >
          {layout.marks.map((mark) => (
            <span
              key={mark.id}
              className={styles.minimapNode}
              style={{
                left: (mark.x - layout.minX) * layout.scale + layout.ox,
                top: (mark.y - layout.minY) * layout.scale + layout.oy,
                width: Math.max(4, NODE_W * layout.scale),
                height: Math.max(3, NODE_H * layout.scale),
                background: mark.color,
              }}
            />
          ))}
          <span
            className={styles.minimapWindow}
            style={{ left: layout.view.x, top: layout.view.y, width: layout.view.w, height: layout.view.h }}
          />
        </div>
      )}
    </>
  );
};
