import React, { useEffect, useMemo, useState } from 'react';
import { useSettingsStore } from '@/stores';
import { STAGES, STAGE_ORDER } from '@/lib/pipeline/catalog';
import { usePipelineStore, nodePosition, NODE_W, NODE_H, NODE_GAP, LANE_WIDTH, LANE_HEADER, LANE_PAD_X } from '@/stores/pipelineStore';
import type { PipelineEdge, PipelineNode, PipelineStageId, PipelineViewport, SceneRef } from '@/types/pipeline';
import { COLLAPSED_HEADER, collapsedClusterSize, collapsedStack, visibleLaneFrames } from './laneFrames';
import { plateAround } from '@/lib/pipeline/clusterLayout';
import { PORT_COLORS } from './geometry';
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

interface Pictured {
  node: PipelineNode;
  image: string;
}

interface ViewerTile {
  id: string;
  title: string;
  image: string;
  cooked: boolean;
  selected: boolean;
}

const LANE_BORDER = 1;

/** Nodes inside a group: the right gap matches the left, and the gap under the header matches that same inset. The bottom edge of the stack stays put. */
function insetGroupedMarks(
  marks: { id: string; left: number; top: number; width: number; height: number; color: string }[],
  innerW: number,
  headerPx: number,
) {
  const placed = marks.map((mark) => ({
    ...mark,
    width: Math.max(2, Math.min(mark.width, innerW - mark.left * 2)),
  }));
  if (placed.length === 0) return placed;
  const gutter = placed[0].left;
  const delta = Math.max(0, headerPx + gutter - placed[0].top);
  const room = placed.map((mark) => Math.max(0, mark.height - 1));
  const totalRoom = room.reduce((sum, value) => sum + value, 0);
  const used = Math.min(delta, totalRoom);
  if (used <= 0) return placed;
  const origin = placed.map((mark) => ({ top: mark.top, height: mark.height }));
  let y = origin[0].top + used;
  placed.forEach((mark, index) => {
    if (index > 0) y += origin[index].top - (origin[index - 1].top + origin[index - 1].height);
    const cut = (room[index] / totalRoom) * used;
    mark.top = y;
    mark.height = origin[index].height - cut;
    y += mark.height;
  });
  return placed;
}

function byStage(a: Pictured, b: Pictured): number {
  const stage = STAGE_ORDER.indexOf(a.node.stage) - STAGE_ORDER.indexOf(b.node.stage);
  if (stage !== 0) return stage;
  return a.node.slot - b.node.slot;
}

/**
 * Main nodes are pictured branch ends: nothing downstream of them also has a picture.
 * The selected node and the last run are always eligible, even when they sit upstream.
 * Past the cap, the rightmost mains stay, and selection plus last run keep their seats.
 */
function collectViewers(
  nodes: PipelineNode[],
  edges: PipelineEdge[],
  cookedId: string | null,
  selectedId: string | null,
  source: 'main' | 'all',
  max: number,
): ViewerTile[] {
  const pictured = nodes
    .map((node) => ({ node, image: activeImage(node) }))
    .filter((item): item is Pictured => !!item.image);
  const picturedIds = new Set(pictured.map((item) => item.node.id));
  const feedsPicture = new Set(
    edges
      .filter((edge) => picturedIds.has(edge.from) && picturedIds.has(edge.to))
      .map((edge) => edge.from),
  );
  const pool = (source === 'all' ? pictured : pictured.filter((item) => !feedsPicture.has(item.node.id))).slice();
  for (const id of [selectedId, cookedId]) {
    if (!id || pool.some((item) => item.node.id === id)) continue;
    const found = pictured.find((item) => item.node.id === id);
    if (found) pool.push(found);
  }
  pool.sort(byStage);
  const unique: Pictured[] = [];
  const seen = new Set<string>();
  for (const item of pool) {
    if (seen.has(item.node.id)) continue;
    seen.add(item.node.id);
    unique.push(item);
  }
  const cap = Math.max(1, Math.min(8, Math.round(max)));
  let chosen = unique;
  if (unique.length > cap) {
    const picked: Pictured[] = [];
    const take = (id: string | null) => {
      if (!id || picked.length >= cap) return;
      const found = unique.find((item) => item.node.id === id);
      if (found && !picked.some((item) => item.node.id === id)) picked.push(found);
    };
    take(selectedId);
    take(cookedId);
    for (let i = unique.length - 1; i >= 0 && picked.length < cap; i -= 1) {
      const item = unique[i];
      if (!picked.some((kept) => kept.node.id === item.node.id)) picked.push(item);
    }
    chosen = picked.sort(byStage);
  }
  return chosen.map((item) => ({
    id: item.node.id,
    title: item.node.title,
    image: item.image,
    cooked: item.node.id === cookedId,
    selected: item.node.id === selectedId,
  }));
}

/**
 * One viewer uses the requested width. Each further viewer multiplies that
 * width by 0.82, then the grid is fitted into 72% of the canvas and the
 * band above the film strip. Aspect stays 16:9 and the picture is contained.
 */
function viewerGrid(count: number, requested: number, canvasW: number, canvasH: number) {
  const n = Math.max(1, count);
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const gap = 8;
  const shrink = Math.pow(0.82, n - 1);
  const asked = Math.max(96, Math.min(240, requested));
  let width = asked * shrink;
  let height = width * (9 / 16);
  if (canvasW > 0 && canvasH > 0) {
    const availW = Math.max(120, canvasW * 0.72 - 32);
    const availH = Math.max(72, canvasH - 168);
    const fitW = (availW - gap * (cols - 1)) / cols;
    const fitH = (availH - gap * (rows - 1)) / rows;
    if (width > fitW) {
      width = fitW;
      height = width * (9 / 16);
    }
    if (height > fitH) {
      height = fitH;
      width = height * (16 / 9);
    }
  }
  return {
    cols,
    gap,
    width: Math.max(64, Math.round(width)),
    height: Math.max(36, Math.round(height)),
  };
}

export const WorkshopOverview: React.FC<WorkshopOverviewProps> = ({
  nodes, viewport, setViewport, canvasRef,
}) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const mapWidth = useSettingsStore((s) => s.settings.appearance.mapWidth ?? 148);
  const mapHeight = useSettingsStore((s) => s.settings.appearance.mapHeight ?? 78);
  const mapOpacity = useSettingsStore((s) => s.settings.appearance.mapOpacity ?? 0.42);
  const mapVisible = useSettingsStore((s) => s.settings.appearance.mapVisible ?? true);
  const resultBackdrop = useSettingsStore((s) => s.settings.appearance.resultBackdrop ?? true);
  const viewerSource = useSettingsStore((s) => s.settings.appearance.viewerSource ?? 'main');
  const viewerMax = useSettingsStore((s) => s.settings.appearance.viewerMax ?? 4);
  const viewerSize = useSettingsStore((s) => s.settings.appearance.viewerSize ?? 168);
  const viewerOpacity = useSettingsStore((s) => s.settings.appearance.viewerOpacity ?? 0.7);
  const cookedId = usePipelineStore((s) => s.lastCookedNodeId);
  const selectedId = usePipelineStore((s) => s.selectedId);
  const edges = usePipelineStore((s) => s.edges);
  const collapsedStages = usePipelineStore((s) => s.collapsedStages);
  const openStages = usePipelineStore((s) => s.openStages);
  const draggingId = usePipelineStore((s) => s.draggingId);
  const dragOverStage = usePipelineStore((s) => s.dragOverStage);
  const dragInsertIndex = usePipelineStore((s) => s.dragInsertIndex);
  const stageLaneColors = useSettingsStore((s) => s.settings.appearance.stageLaneColors);
  const viewers = useMemo(
    () => collectViewers(nodes, edges, cookedId, selectedId, viewerSource, viewerMax),
    [nodes, edges, cookedId, selectedId, viewerSource, viewerMax],
  );
  const grid = useMemo(
    () => viewerGrid(Math.max(1, viewers.length), viewerSize, size.width, size.height),
    [viewers.length, viewerSize, size.width, size.height],
  );

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
    const colorOf = (stage: PipelineStageId) => stageLaneColors?.[stage] || STAGES[stage].color;
    const frames = visibleLaneFrames(nodes, {
      collapsed: collapsedStages,
      pinned: openStages,
      excludeId: draggingId,
      growStage: dragOverStage,
    });
    const lanes = frames.map((frame) => {
      const collapsed = collapsedStages.includes(frame.stage);
      const members = nodes
        .filter((node) => node.stage === frame.stage && node.inLane !== false && node.id !== draggingId)
        .sort((a, b) => a.slot - b.slot);
      const stack = collapsed ? collapsedStack(members.length) : [];
      const marks = members.map((node, index) => {
        if (collapsed) {
          const card = stack[index];
          const prevLip = index === 0 ? 0 : stack[index - 1].lip;
          return {
            id: node.id,
            x: frame.x + LANE_PAD_X + card.shiftX,
            y: frame.y + COLLAPSED_HEADER + prevLip,
            w: NODE_W,
            h: Math.max(1, card.lip - prevLip),
            color: colorOf(node.stage),
          };
        }
        const pos = nodePosition(node);
        const pushed = dragOverStage === frame.stage && dragInsertIndex != null && node.slot >= dragInsertIndex;
        return {
          id: node.id,
          x: pos.x,
          y: pos.y + (pushed ? NODE_H + NODE_GAP : 0),
          w: NODE_W,
          h: NODE_H,
          color: colorOf(node.stage),
        };
      });
      return {
        stage: frame.stage,
        x: frame.x,
        y: frame.y,
        w: frame.w,
        h: frame.h,
        header: collapsed ? COLLAPSED_HEADER : LANE_HEADER,
        color: colorOf(frame.stage),
        marks,
      };
    });
    const grouped = new Set(lanes.flatMap((lane) => lane.marks.map((mark) => mark.id)));
    const foldedAway = new Set(nodes.filter((node) => node.clusterCollapsed).map((node) => node.id));
    const free = nodes
      .filter((node) => !grouped.has(node.id) && !foldedAway.has(node.id))
      .map((node) => {
        const pos = nodePosition(node);
        return { id: node.id, x: pos.x, y: pos.y, w: NODE_W, h: NODE_H, color: colorOf(node.stage) };
      });
    const clusterMembers = new Map<string, PipelineNode[]>();
    for (const node of nodes) {
      if (!node.clusterId || node.x === undefined || node.y === undefined) continue;
      const members = clusterMembers.get(node.clusterId) ?? [];
      members.push(node);
      clusterMembers.set(node.clusterId, members);
    }
    const clusters = [...clusterMembers.entries()].map(([id, members]) => {
      const counts = new Map<PipelineStageId, number>();
      for (const member of members) counts.set(member.stage, (counts.get(member.stage) ?? 0) + 1);
      const stage = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const plate = members.find((member) => member.clusterFrame)?.clusterFrame
        ?? plateAround(members.map((member) => ({ x: member.x ?? 0, y: member.y ?? 0 })));
      const collapsed = members.some((member) => member.clusterCollapsed);
      const closed = collapsedClusterSize(members.length);
      return {
        id,
        x: plate.x,
        y: plate.y,
        w: collapsed ? closed.w : plate.w,
        h: collapsed ? closed.h : plate.h,
        color: colorOf(stage),
        memberIds: collapsed ? members.map((member) => member.id) : [],
      };
    });
    if (lanes.length === 0 && free.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const cover = (x: number, y: number, w: number, h: number) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    };
    for (const lane of lanes) cover(lane.x, lane.y, lane.w, lane.h);
    for (const mark of free) cover(mark.x, mark.y, mark.w, mark.h);
    for (const plate of clusters) cover(plate.x, plate.y, plate.w, plate.h);
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
    return { lanes, free, clusters, minX, minY, scale, ox, oy, mapW, mapH, view };
  }, [
    nodes, viewport, size, mapWidth, mapHeight,
    collapsedStages, openStages, draggingId, dragOverStage, dragInsertIndex, stageLaneColors,
  ]);

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
        <div className={styles.outputBackdrop} data-viewer-count={viewers.length} aria-hidden={viewers.length === 0}>
          {viewers.length > 0 ? (
            <div
              className={styles.viewerBank}
              style={{
                gridTemplateColumns: `repeat(${grid.cols}, ${grid.width}px)`,
                gap: grid.gap,
              }}
            >
              {viewers.map((viewer) => (
                <div
                  key={viewer.id}
                  className={`${styles.viewerTile} ${viewer.cooked ? styles.cooked : ''} ${viewer.selected ? styles.selected : ''}`}
                  style={{ width: grid.width, height: grid.height }}
                  title={viewer.title}
                >
                  <img src={viewer.image} alt="" style={{ opacity: Math.max(0.25, Math.min(1, viewerOpacity)) }} />
                  <span className={styles.viewerLabel}>{viewer.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.outputEmpty}>Run a node to place its picture in a viewer.</div>
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
          {layout.clusters.map((plate) => (
            <span
              key={plate.id}
              className={styles.minimapLane}
              style={{
                left: (plate.x - layout.minX) * layout.scale + layout.ox,
                top: (plate.y - layout.minY) * layout.scale + layout.oy,
                width: Math.max(4, plate.w * layout.scale),
                height: Math.max(3, plate.h * layout.scale),
                ['--stage-color' as string]: plate.color,
              }}
            />
          ))}
          {layout.lanes.map((lane) => (
            <span
              key={lane.stage}
              className={styles.minimapLane}
              style={{
                left: (lane.x - layout.minX) * layout.scale + layout.ox,
                top: (lane.y - layout.minY) * layout.scale + layout.oy,
                width: Math.max(4, lane.w * layout.scale),
                height: Math.max(3, lane.h * layout.scale),
                ['--stage-color' as string]: lane.color,
              }}
            >
              {insetGroupedMarks(
                lane.marks.map((mark) => ({
                  id: mark.id,
                  left: (mark.x - lane.x) * layout.scale,
                  top: (mark.y - lane.y) * layout.scale,
                  width: Math.max(2, mark.w * layout.scale),
                  height: Math.max(1, mark.h * layout.scale),
                  color: mark.color,
                })),
                Math.max(4, lane.w * layout.scale) - LANE_BORDER * 2,
                (lane.header / lane.h) * (Math.max(3, lane.h * layout.scale) - LANE_BORDER * 2),
              ).map((mark) => (
                <span
                  key={mark.id}
                  className={styles.minimapNode}
                  style={{
                    left: mark.left,
                    top: mark.top,
                    width: mark.width,
                    height: mark.height,
                    background: mark.color,
                  }}
                />
              ))}
              <span
                className={styles.minimapLaneHeader}
                style={{ height: `${(lane.header / lane.h) * 100}%` }}
              />
            </span>
          ))}
          {layout.free.map((mark) => (
            <span
              key={mark.id}
              className={styles.minimapNode}
              style={{
                left: (mark.x - layout.minX) * layout.scale + layout.ox,
                top: (mark.y - layout.minY) * layout.scale + layout.oy,
                width: Math.max(4, mark.w * layout.scale),
                height: Math.max(3, mark.h * layout.scale),
                background: mark.color,
              }}
            />
          ))}
          <svg className={styles.minimapEdges} viewBox={`0 0 ${layout.mapW} ${layout.mapH}`} aria-hidden>
            {edges.map((edge) => {
              const locate = (id: string) => {
                for (const lane of layout.lanes) {
                  const mark = lane.marks.find((item) => item.id === id);
                  if (mark) return mark;
                }
                const folded = layout.clusters.find((plate) => plate.memberIds.includes(id));
                if (folded) return folded;
                return layout.free.find((item) => item.id === id);
              };
              const fromFold = layout.clusters.find((plate) => plate.memberIds.includes(edge.from));
              const toFold = layout.clusters.find((plate) => plate.memberIds.includes(edge.to));
              if (fromFold && toFold && fromFold.id === toFold.id) return null;
              const from = locate(edge.from);
              const to = locate(edge.to);
              if (!from || !to) return null;
              return (
                <line
                  key={edge.id}
                  x1={(from.x + from.w - layout.minX) * layout.scale + layout.ox}
                  y1={(from.y + from.h / 2 - layout.minY) * layout.scale + layout.oy}
                  x2={(to.x - layout.minX) * layout.scale + layout.ox}
                  y2={(to.y + to.h / 2 - layout.minY) * layout.scale + layout.oy}
                  stroke={PORT_COLORS[edge.type] ?? '#8a8aa2'}
                />
              );
            })}
          </svg>
          <span
            className={styles.minimapWindow}
            style={{ left: layout.view.x, top: layout.view.y, width: layout.view.w, height: layout.view.h }}
          />
        </div>
      )}
    </>
  );
};
