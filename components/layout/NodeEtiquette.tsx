import React, { useCallback, useMemo, useState } from 'react';
import {
  MessageSquareText,
  Cpu,
  GitBranch,
  Sparkles,
  Film,
  Headphones,
  Image as ImageIcon,
  Layers,
  Link2,
  Trash2,
  Ungroup,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  Copy,
  X,
  Plus,
  Pencil,
} from 'lucide-react';
import type { CanvasItem, GenerationMeta } from '@/types';
import { useCanvasStore } from '@/stores/canvasStore';
import styles from './Canvas.module.css';

type NodeTabId = 'name' | 'prompt' | 'info' | 'versions' | 'layers';

interface NodeEtiquetteProps {
  item: CanvasItem;
  meta: GenerationMeta | undefined;
  zoom: number;
  orbColor: string;
  isOrbOpen: boolean;
  activeTab: NodeTabId | null;
  tabsMaxW: number;
  editingItemId: string | null;
  editingName: string;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  onToggleOrb: () => void;
  onToggleTab: (tab: NodeTabId) => void;
  onTagPointerDown: (e: React.PointerEvent) => void;
  onResetEtiquettePosition: () => void;
  onFocusRelated: (id: string) => void;
  onTagDoubleClick: (e: React.MouseEvent) => void;
  onEditNameChange: (value: string) => void;
  onEditKeyDown: (e: React.KeyboardEvent) => void;
  onSaveName: () => void;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  generated: <Sparkles size={10} />,
  image:     <ImageIcon size={10} />,
  video:     <Film size={10} />,
  audio:     <Headphones size={10} />,
  text:      <MessageSquareText size={10} />,
  template:  <Cpu size={10} />,
  drawing:   <Pencil size={10} />,
};

/** Collapsible section inside the etiquette panel */
const EtiquetteSection: React.FC<{
  icon: React.ReactNode;
  label: string;
  badge?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ icon, label, badge, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.etiquetteSection}>
      <button
        className={styles.etiquetteSectionHeader}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      >
        <span className={styles.etiquetteSectionIcon}>{icon}</span>
        <span className={styles.etiquetteSectionLabel}>{label}</span>
        {badge != null && badge > 0 && (
          <span className={styles.etiquetteSectionBadge}>{badge}</span>
        )}
        <span className={styles.etiquetteSectionChevron}>
          {open ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
        </span>
      </button>
      {open && <div className={styles.etiquetteSectionBody}>{children}</div>}
    </div>
  );
};

export const NodeEtiquette: React.FC<NodeEtiquetteProps> = ({
  item,
  meta,
  zoom,
  orbColor,
  isOrbOpen,
  activeTab: _activeTab,
  tabsMaxW: _tabsMaxW,
  editingItemId,
  editingName,
  editInputRef,
  onToggleOrb,
  onToggleTab: _onToggleTab,
  onTagPointerDown,
  onResetEtiquettePosition: _onResetEtiquettePosition,
  onFocusRelated,
  onTagDoubleClick,
  onEditNameChange,
  onEditKeyDown,
  onSaveName,
}) => {
  const {
    getRelatedItems,
    getChildLayers,
    selectItem,
    removeItem,
    detachLayerFromParent,
    updateItem,
    bringToFront,
    addItem,
    ungroupItems,
    items: allItems,
  } = useCanvasStore();

  const promptText = meta?.prompt || item.prompt || '';
  const relatedItems = useMemo(() => getRelatedItems(item.id), [getRelatedItems, item.id]);
  const childLayers = useMemo(() => getChildLayers(item.id), [getChildLayers, item.id]);
  const typeIcon = TYPE_ICONS[item.type] ?? <ImageIcon size={10} />;

  // Parent assets for provenance
  const parentAssets = useMemo(() => {
    const pids = meta?.parentIds ?? [];
    return pids
      .map((pid) => allItems.find((i) => i.id === pid || i.assetId === pid))
      .filter(Boolean) as CanvasItem[];
  }, [meta?.parentIds, allItems]);

  const handleCopyPrompt = useCallback(() => {
    navigator.clipboard.writeText(promptText).catch(() => {});
  }, [promptText]);

  // The etiquette is overlaid at the TOP of the node.
  // Title bar: full node width. Panel: at least 200 canvas-px wide.
  // We compensate for zoom so the bar stays a fixed pixel height on screen.
  const nodeVisualW = item.width * item.scale * zoom;
  const titleW = Math.max(80 * zoom, nodeVisualW);
  const panelW = Math.max(titleW, 200 * zoom);

  // Round orb size (scales with zoom: 28px on screen)
  const orbSize = 28 * zoom;

  return (
    <div
      className={styles.etiquetteRoot}
      style={{
        // Sit ABOVE the node: bottom of visual title bar aligns exactly with node top
        left: 0,
        top: -(28 / zoom),
        transform: `scale(${1 / zoom})`,
        transformOrigin: 'top left',
        ['--orb-color' as string]: orbColor,
        width: `${panelW}px`,
        ['--eti-title-w' as string]: `${titleW}px`,
      }}
    >
      {/* ── Sticky title bar (always at top of node) ── */}
      <div
        className={styles.etiquetteTitleBar}
        onDoubleClick={onTagDoubleClick}
        title={item.name}
      >
        {/* Type dot */}
        <span
          className={styles.etiquetteTitleDot}
          style={{ background: orbColor }}
        />

        {/* Type icon */}
        <span className={styles.etiquetteTitleTypeIcon} style={{ color: orbColor }}>
          {typeIcon}
        </span>

        {/* Name (editable on double-click) */}
        {editingItemId === item.id ? (
          <input
            ref={editInputRef}
            className={styles.etiquetteTitleInput}
            value={editingName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onKeyDown={onEditKeyDown}
            onBlur={onSaveName}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <span className={styles.etiquetteTitleName}>
            {item.name.length > 28 ? `${item.name.slice(0, 26)}…` : item.name}
          </span>
        )}

        {/* Visibility + lock toggles */}
        <div className={styles.etiquetteTitleActions} onClick={(e) => e.stopPropagation()}>
          <button
            className={styles.etiquetteTitleBtn}
            onClick={() => updateItem(item.id, { visible: !item.visible })}
            title={item.visible ? 'Hide' : 'Show'}
          >
            {item.visible ? <Eye size={9} /> : <EyeOff size={9} />}
          </button>
          <button
            className={styles.etiquetteTitleBtn}
            onClick={() => updateItem(item.id, { locked: !item.locked })}
            title={item.locked ? 'Unlock' : 'Lock'}
          >
            {item.locked ? <Lock size={9} /> : <Unlock size={9} />}
          </button>
        </div>

        {/* ── Round expand orb ── */}
        <button
          className={`${styles.etiquetteOrb} ${isOrbOpen ? styles.etiquetteOrbOpen : ''}`}
          style={{
            width: orbSize,
            height: orbSize,
            background: isOrbOpen
              ? orbColor
              : `radial-gradient(circle at 38% 35%, color-mix(in srgb, ${orbColor} 60%, #fff) 0%, ${orbColor} 100%)`,
            boxShadow: `0 0 ${isOrbOpen ? 14 : 8}px ${orbColor}88, 0 0 ${isOrbOpen ? 28 : 0}px ${orbColor}44`,
          }}
          onClick={(e) => { e.stopPropagation(); onToggleOrb(); }}
          title={isOrbOpen ? 'Collapse details' : 'Expand details'}
        >
          <ChevronDown
            size={12}
            style={{
              transform: isOrbOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s var(--spring-smooth, ease)',
              color: '#fff',
            }}
          />
        </button>
      </div>

      {/* ── Expanded detail panel ── */}
      {isOrbOpen && (
        <div
          className={styles.etiquettePanel}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* ── Prompt & Generation ── */}
          <EtiquetteSection icon={<MessageSquareText size={10} />} label="Prompt" defaultOpen={!!promptText}>
            {meta?.model ? (
              <div className={styles.etiquetteModelRow}>
                <Cpu size={9} />
                <span>{meta.model}</span>
                {meta.seed != null && (
                  <span className={styles.etiquetteSeed}>#{meta.seed}</span>
                )}
              </div>
            ) : (
              <div className={styles.etiquetteModelRow} style={{ opacity: 0.5 }}>
                <Cpu size={9} /> <span>No model info</span>
              </div>
            )}
            {promptText ? (
              <>
                <p className={styles.etiquettePromptText}>{promptText}</p>
                {meta?.negativePrompt && (
                  <p className={styles.etiquetteNegText}>− {meta.negativePrompt}</p>
                )}
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <button className={styles.etiquetteCopyBtn} onClick={handleCopyPrompt}>
                    <Copy size={9} /> Copy prompt
                  </button>
                </div>
              </>
            ) : (
              <p className={styles.etiquettePromptText} style={{ opacity: 0.4 }}>No prompt recorded</p>
            )}
          </EtiquetteSection>

          {/* ── Annotation / Meta Layers ── */}
          <EtiquetteSection
            icon={<Layers size={10} />}
            label="Annotation Layers"
            badge={childLayers.length}
            defaultOpen={childLayers.length > 0}
          >
            {childLayers.length === 0 ? (
              <p className={styles.etiquettePromptText} style={{ opacity: 0.4 }}>
                No annotation layers — draw or add text to create sublayers
              </p>
            ) : (
              childLayers.map((layer) => {
                const isLayerVisible = layer.visible !== false;
                return (
                  <div
                    key={layer.id}
                    className={styles.sublayerRow}
                    onClick={() => selectItem(layer.id)}
                  >
                    <span className={styles.sublayerType}>
                      {layer.overlayKind === 'pen' ? '✏' : layer.overlayKind === 'text' ? 'T' : '◻'}
                    </span>
                    <span className={styles.sublayerName}>{layer.name || `Layer ${layer.zIndex}`}</span>
                    <div className={styles.sublayerActions}>
                      <button
                        className={styles.sublayerBtn}
                        onClick={(e) => { e.stopPropagation(); updateItem(layer.id, { visible: !isLayerVisible }); }}
                        title={isLayerVisible ? 'Hide' : 'Show'}
                      >
                        {isLayerVisible ? <Eye size={9} /> : <EyeOff size={9} />}
                      </button>
                      {layer.parentItemId && (
                        <button
                          className={styles.sublayerBtn}
                          onClick={(e) => { e.stopPropagation(); detachLayerFromParent(layer.id); }}
                          title="Detach layer"
                        >
                          <Ungroup size={9} />
                        </button>
                      )}
                      <button
                        className={styles.sublayerBtn}
                        onClick={(e) => { e.stopPropagation(); removeItem(layer.id); }}
                        title="Delete layer"
                      >
                        <X size={9} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            <button
              className={styles.etiquetteAddLayerBtn}
              title="Add annotation layer"
              onClick={(e) => {
                e.stopPropagation();
                const newLayer = addItem({
                  type: 'drawing',
                  overlayKind: 'pen',
                  parentItemId: item.id,
                  layerRole: 'overlay',
                  name: `Annotation ${childLayers.length + 1}`,
                  x: item.x, y: item.y,
                  width: item.width, height: item.height,
                  scale: item.scale, rotation: item.rotation,
                  visible: true, locked: false,
                });
                selectItem(newLayer.id);
              }}
            >
              <Plus size={9} /> Add layer
            </button>
          </EtiquetteSection>

          {/* ── Related / parent assets (lineage) ── */}
          <EtiquetteSection
            icon={<Link2 size={10} />}
            label="Related Assets"
            badge={parentAssets.length + relatedItems.length}
            defaultOpen={parentAssets.length > 0 || relatedItems.length > 0}
          >
            {parentAssets.length === 0 && relatedItems.length === 0 ? (
              <p className={styles.etiquettePromptText} style={{ opacity: 0.4 }}>No related assets</p>
            ) : (
              <>
                {parentAssets.length > 0 && (
                  <>
                    <div className={styles.etiquetteRelLabel}>Derived from</div>
                    <div className={styles.etiquetteRelGrid}>
                      {parentAssets.map((pa) => (
                        <button
                          key={pa.id}
                          className={styles.etiquetteRelThumb}
                          onClick={() => { onFocusRelated(pa.id); selectItem(pa.id); }}
                          title={pa.name}
                        >
                          {pa.src
                            ? <img src={pa.src} alt="" />
                            : <span className={styles.etiquetteRelPlaceholder}>{typeIcon}</span>}
                          <span>{pa.name.slice(0, 12)}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {relatedItems.length > 0 && (
                  <>
                    <div className={styles.etiquetteRelLabel}>Related</div>
                    <div className={styles.etiquetteRelGrid}>
                      {relatedItems.map((ri) => (
                        <button
                          key={ri.id}
                          className={styles.etiquetteRelThumb}
                          onClick={() => onFocusRelated(ri.id)}
                          title={ri.name}
                        >
                          {ri.src
                            ? <img src={ri.src} alt="" />
                            : <span className={styles.etiquetteRelPlaceholder}><Link2 size={10} /></span>}
                          <span>{ri.name.slice(0, 12)}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </EtiquetteSection>

          {/* ── Metadata / Info ── */}
          <EtiquetteSection icon={<Cpu size={10} />} label="Info" defaultOpen={false}>
            <div className={styles.etiquetteInfoRow}>
              <span>Type</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--orb-color)', display: 'inline-block' }} />
                {item.type}
              </span>
            </div>
            <div className={styles.etiquetteInfoRow}>
              <span>Size</span>
              <span>{Math.round(item.width * item.scale)} × {Math.round(item.height * item.scale)}</span>
            </div>
            <div className={styles.etiquetteInfoRow}>
              <span>Position</span>
              <span>{Math.round(item.x)}, {Math.round(item.y)}</span>
            </div>
            {meta?.model && (
              <div className={styles.etiquetteInfoRow}>
                <span>Model</span><span>{meta.model}</span>
              </div>
            )}
            {meta?.seed != null && (
              <div className={styles.etiquetteInfoRow}>
                <span>Seed</span><span>{meta.seed}</span>
              </div>
            )}
            {meta?.width && meta?.height && (
              <div className={styles.etiquetteInfoRow}>
                <span>Gen size</span><span>{meta.width} × {meta.height}</span>
              </div>
            )}
            {meta?.generatedAt && (
              <div className={styles.etiquetteInfoRow}>
                <span>Generated</span>
                <span>{new Date(meta.generatedAt).toLocaleDateString()}</span>
              </div>
            )}
            {item.mediaMeta?.duration != null && item.mediaMeta.duration > 0 && (
              <div className={styles.etiquetteInfoRow}>
                <span>Duration</span>
                <span>{Math.round(item.mediaMeta.duration)}s</span>
              </div>
            )}
            {item.mediaMeta?.mimeType && (
              <div className={styles.etiquetteInfoRow}>
                <span>Format</span><span>{item.mediaMeta.mimeType}</span>
              </div>
            )}
            {item.mediaMeta?.codec && (
              <div className={styles.etiquetteInfoRow}>
                <span>Codec</span><span>{item.mediaMeta.codec}</span>
              </div>
            )}
            {item.assetId && (
              <div className={styles.etiquetteInfoRow}>
                <span>Asset ID</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', opacity: 0.6 }}>
                  {item.assetId.slice(0, 14)}…
                </span>
              </div>
            )}
          </EtiquetteSection>

          {/* ── Versions / Variations ── */}
          {(meta?.variations?.length ?? 0) > 0 && (
            <EtiquetteSection
              icon={<GitBranch size={10} />}
              label="Versions"
              badge={meta!.variations!.length}
              defaultOpen={false}
            >
              {meta!.variations!.map((v) => (
                <div key={v.id} className={styles.etiquetteInfoRow}>
                  <span>{v.label}</span>
                  <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>{v.id.slice(0, 8)}</span>
                </div>
              ))}
            </EtiquetteSection>
          )}

          {/* ── Footer actions ── */}
          <div className={styles.etiquettePanelFooter}>
            <button
              className={styles.etiquetteFooterBtn}
              onClick={() => bringToFront(item.id)}
              title="Bring to front"
            >
              Bring to Front
            </button>
            {item.groupId && (
              <button
                className={styles.etiquetteFooterBtn}
                onClick={() => ungroupItems(item.groupId!)}
                title="Remove from group"
              >
                <Ungroup size={10} /> Ungroup
              </button>
            )}
            {item.parentItemId && (
              <button
                className={styles.etiquetteFooterBtn}
                onClick={() => onFocusRelated(item.parentItemId!)}
                title="Go to parent"
              >
                <Link2 size={10} /> Parent
              </button>
            )}
            <button
              className={`${styles.etiquetteFooterBtn} ${styles.etiquetteFooterBtnDanger}`}
              onClick={() => removeItem(item.id)}
              title="Delete item"
            >
              <Trash2 size={10} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export type { NodeTabId };
