import React, { useCallback, useRef } from 'react';
import {
  Play, Loader2, Layers, FileText, ImageOff,
  Palette, Scroll, Users, LayoutGrid, Image as ImageIcon, Clapperboard,
  Music, Film, Send, Upload, Sparkles, Droplet, Fingerprint, Quote, PenLine,
  MessageCircle, ListTree, User, Contact, MapPin, Mountain, Box, ListOrdered,
  GalleryHorizontal, ImagePlus, Wand2, Maximize, SlidersHorizontal, FileVideo,
  Move, Gauge, Anchor, FileAudio, Mic, Waves, ClipboardCheck, Captions, Type,
  Heading, Proportions, Cog, GalleryThumbnails, Sliders, FlaskConical, Pencil, Boxes,
} from 'lucide-react';
import type { PipelineNode } from '@/types/pipeline';
import { PIPELINE_NODE_DEFS, STAGES } from '@/lib/pipeline/catalog';
import { usePipelineStore, nodePosition, NODE_W, NODE_H } from '@/stores/pipelineStore';
import { PORT_COLORS, PORT_TOP, PORT_SPACING } from './geometry';
import { NodeDeck } from './NodeDeck';
import { LayerOverlay } from './LayerSystem';
import styles from './WorkshopFlow.module.css';

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  palette: Palette, scroll: Scroll, users: Users, 'layout-grid': LayoutGrid,
  image: ImageIcon, clapperboard: Clapperboard, music: Music, film: Film, send: Send,
  upload: Upload, sparkles: Sparkles, droplet: Droplet, fingerprint: Fingerprint,
  quote: Quote, 'pen-line': PenLine, 'message-circle': MessageCircle, 'list-tree': ListTree,
  user: User, contact: Contact, 'map-pin': MapPin, mountain: Mountain, box: Box,
  'list-ordered': ListOrdered, 'gallery-horizontal': GalleryHorizontal,
  'image-plus': ImagePlus, wand: Wand2, maximize: Maximize, sliders: Sliders,
  'file-video': FileVideo, play: Play, move: Move, gauge: Gauge, anchor: Anchor,
  'file-audio': FileAudio, mic: Mic, waves: Waves, 'sliders-horizontal': SlidersHorizontal,
  'clipboard-check': ClipboardCheck, captions: Captions, type: Type, heading: Heading,
  proportions: Proportions, cog: Cog, 'gallery-thumbnails': GalleryThumbnails,
  'file-text': FileText, flask: FlaskConical, pencil: Pencil, boxes: Boxes,
};

export function nodeIcon(name: string, size = 13): React.ReactNode {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon size={size} />;
}

interface Props {
  node: PipelineNode;
  zoom: number;
  apiKey: string;
}

export const PipelineNodeCard: React.FC<Props> = React.memo(function PipelineNodeCard({ node, zoom, apiKey }) {
  const def = PIPELINE_NODE_DEFS[node.type];
  const stage = STAGES[node.stage];
  // Only `selectedId` needs to be a reactive subscription (it drives the
  // `isSelected` render below) — the rest are stable action functions and a
  // click-time-only flag, read live via getState() instead of subscribing.
  // Previously this whole-store-destructured, so editing ANY node's params
  // re-rendered EVERY node card on the canvas, not just the edited one.
  const selectedId = usePipelineStore((s) => s.selectedId);

  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const pos = nodePosition(node);
  const active = node.variants.find((v) => v.id === node.activeVariantId) ?? node.variants[0];
  const isSelected = selectedId === node.id;
  const isRunning = node.status === 'running';

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-port], [data-deck], button')) return;
    e.stopPropagation();
    usePipelineStore.getState().select(node.id);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [node.id, pos.x, pos.y]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / zoom;
    const dy = (e.clientY - d.startY) / zoom;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    setDragging(true);
    usePipelineStore.getState().setNodePosition(node.id, d.origX + dx, d.origY + dy);
  }, [node.id, zoom]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
    // Deliberately no snap-back-into-lane here: `handlePointerMove` already
    // live-updated the node's x/y via setNodePosition, and it now just stays
    // wherever it was dropped — matching the "put it anywhere" freedom the
    // old freeform Canvas had, on the same node graph instead of a second,
    // incompatible editor. The node's `stage` (and its lane-grouping/
    // execution-order membership) is unaffected by where it's dragged.
  }, []);

  if (!def) return null;

  // Closed-deck ghost cards — variants literally stack above/behind the node
  const ghostCount = Math.min(3, Math.max(0, node.variants.length - 1));

  return (
    <div
      data-node
      className={[
        styles.nodeWrap,
        isSelected ? styles.nodeSelected : '',
        isRunning ? styles.nodeRunning : '',
        node.status === 'error' ? styles.nodeError : '',
        dragging ? styles.dragging : '',
      ].join(' ')}
      style={{
        left: pos.x,
        top: pos.y,
        width: NODE_W,
        height: NODE_H,
        zIndex: isSelected || node.deckOpen ? 20 : 10,
        ['--stage-color' as string]: stage.color,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Variant stack ghosts (3D deck behind the card) */}
      {Array.from({ length: ghostCount }).map((_, i) => (
        <div
          key={i}
          className={styles.deckGhost}
          style={{
            transform: `translate(${(i + 1) * 7}px, ${-(i + 1) * 7}px) scale(${1 - (i + 1) * 0.02})`,
            opacity: 0.75 - i * 0.22,
            zIndex: -1 - i,
          }}
        />
      ))}

      <div className={styles.node}>
        <div className={styles.nodeHeader}>
          <span className={styles.nodeIcon}>{nodeIcon(def.icon)}</span>
          <div className={styles.nodeTitleBox}>
            <div className={styles.nodeTitle}>{node.title}</div>
            <div className={styles.nodeSubtitle}>{def.subtitle}</div>
          </div>
          <span className={styles.nodeStatus}>
            {isRunning ? (
              <Loader2 size={13} className={styles.spin} />
            ) : (
              <span
                className={`${styles.statusDot} ${
                  node.status === 'done' ? styles.statusDone
                  : node.status === 'error' ? styles.statusError
                  : styles.statusIdle
                }`}
              />
            )}
          </span>
        </div>

        <div className={styles.nodePreview}>
          {active?.image ? (
            <>
              <img src={active.image} alt={node.title} draggable={false} />
              <LayerOverlay variant={active} />
            </>
          ) : active?.text ? (
            <div className={styles.previewText}>{active.text}</div>
          ) : node.status === 'error' ? (
            <div className={styles.errorText}>{node.error}</div>
          ) : (
            <div className={styles.previewEmpty}>
              <ImageOff size={16} />
              <span>
                {def.execution === 'import' ? 'Import in inspector'
                  : def.execution === 'manual' ? 'Author in inspector'
                  : 'Not generated yet'}
              </span>
            </div>
          )}
        </div>

        <div className={styles.nodeFooter}>
          <button
            className={`${styles.nodeBtn} ${styles.nodeBtnPrimary}`}
            disabled={isRunning}
            onClick={(e) => { e.stopPropagation(); void usePipelineStore.getState().runNode(node.id, apiKey); }}
            title={def.execution.startsWith('banana') ? 'Generate with banana2' : 'Apply / snapshot'}
          >
            {isRunning ? <Loader2 size={11} className={styles.spin} /> : <Play size={11} />}
            {def.execution.startsWith('banana') ? 'Generate' : 'Apply'}
          </button>
          <button
            data-deck
            className={styles.variantBadge}
            onClick={(e) => { e.stopPropagation(); usePipelineStore.getState().toggleDeck(node.id); }}
            title="Layers · versions · info"
          >
            <Layers size={10} />
            {node.variants.length > 0 ? node.variants.length : '+'}
          </button>
        </div>

        {/* Ports */}
        {def.inputs.map((port, i) => (
          <div
            key={`in-${port.id}`}
            data-port
            className={`${styles.port} ${styles.portIn}`}
            style={{
              top: PORT_TOP + i * PORT_SPACING - 6,
              ['--port-color' as string]: PORT_COLORS[port.type] ?? '#8a8aa2',
            }}
            title={`${port.label} (${port.type}${port.multi ? ', multi' : ''})`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => {
              e.stopPropagation();
              const s = usePipelineStore.getState();
              if (s.pendingEdge) s.completeEdge(node.id, port.id, port.type);
            }}
            onClick={(e) => {
              e.stopPropagation();
              const s = usePipelineStore.getState();
              if (s.pendingEdge) s.completeEdge(node.id, port.id, port.type);
            }}
          >
            <span className={styles.portLabel}>{port.label}</span>
          </div>
        ))}
        {def.outputs.map((port, i) => (
          <div
            key={`out-${port.id}`}
            data-port
            className={`${styles.port} ${styles.portOut}`}
            style={{
              top: PORT_TOP + i * PORT_SPACING - 6,
              ['--port-color' as string]: PORT_COLORS[port.type] ?? '#8a8aa2',
            }}
            title={`${port.label} (${port.type}) — drag to an input`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              usePipelineStore.getState().startEdge(node.id, port.id, port.type);
            }}
          >
            <span className={styles.portLabel}>{port.label}</span>
          </div>
        ))}
      </div>

      {/* Tabbed dropdown: layers · versions · info — flips below when near the top */}
      {node.deckOpen && (
        <NodeDeck
          node={node}
          below={usePipelineStore.getState().viewport.y + pos.y * zoom < 480}
        />
      )}
    </div>
  );
});
