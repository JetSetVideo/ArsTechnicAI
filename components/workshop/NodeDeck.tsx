import React, { useState } from 'react';
import { FileText, Pin, Trash2, X, Layers, GitCommitVertical, Info, Maximize2, Wand2 } from 'lucide-react';
import type { PipelineNode } from '@/types/pipeline';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useSettingsStore } from '@/stores';
import { LayersPanelBody, VariantInfoBody, activeVariantOf } from './LayerSystem';
import { RetouchPanel } from './RetouchPanel';
import styles from './WorkshopFlow.module.css';

type DeckTab = 'variants' | 'layers' | 'retouch' | 'info';

/**
 * The dropdown that opens above a node: manage stacked alternatives (versions),
 * the layer stack of the active picture, and its full metadata.
 */
export const NodeDeck: React.FC<{ node: PipelineNode; below?: boolean }> = ({ node, below }) => {
  const { selectVariant, removeVariant, pinVariant, toggleDeck, openEditor } = usePipelineStore();
  const { settings } = useSettingsStore();
  const apiKey = settings.aiProvider.apiKeys?.GOOGLE_IMAGEN || settings.aiProvider.apiKey || '';
  const [tab, setTab] = useState<DeckTab>(node.variants.some((v) => v.image) ? 'retouch' : 'variants');
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const variant = activeVariantOf(node);

  return (
    <div
      className={`${styles.deckPanel} ${below ? styles.deckPanelBelow : ''}`}
      data-deck
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className={styles.deckTabs}>
        <button className={`${styles.deckTab} ${tab === 'retouch' ? styles.deckTabActive : ''}`} onClick={() => setTab('retouch')}>
          <Wand2 size={11} /> Retouch
        </button>
        <button className={`${styles.deckTab} ${tab === 'layers' ? styles.deckTabActive : ''}`} onClick={() => setTab('layers')}>
          <Layers size={11} /> Layers
        </button>
        <button className={`${styles.deckTab} ${tab === 'variants' ? styles.deckTabActive : ''}`} onClick={() => setTab('variants')}>
          <GitCommitVertical size={11} /> v·{node.variants.length}
        </button>
        <button className={`${styles.deckTab} ${tab === 'info' ? styles.deckTabActive : ''}`} onClick={() => setTab('info')}>
          <Info size={11} /> Info
        </button>
        {variant?.image && (
          <button className={styles.layerIconBtn} title="Open full layer editor" onClick={() => openEditor(node.id)}>
            <Maximize2 size={12} />
          </button>
        )}
        <button className={styles.layerIconBtn} title="Close" onClick={() => toggleDeck(node.id)}>
          <X size={13} />
        </button>
      </div>

      {tab === 'variants' && (
        <div className={styles.deckScroll}>
          {node.variants.length === 0 && <div className={styles.layerEmptyHint}>No versions yet — run Generate.</div>}
          {node.variants.map((v) => (
            <div
              key={v.id}
              className={`${styles.variantRow} ${v.id === (node.activeVariantId ?? node.variants[0]?.id) ? styles.variantActive : ''}`}
              onClick={() => selectVariant(node.id, v.id)}
            >
              {v.image ? (
                <img className={styles.variantThumb} src={v.image} alt={v.label} />
              ) : (
                <span className={styles.variantThumbText}><FileText size={14} /></span>
              )}
              <div className={styles.variantMeta}>
                <div className={styles.variantLabel}>
                  v{v.version ?? 1} · {v.label}{v.seed !== undefined ? ` · seed ${v.seed}` : ''}
                </div>
                <div className={styles.variantSnippet}>
                  {(v.layers?.length ?? 0) > 0 ? `${v.layers!.length} layer${v.layers!.length > 1 ? 's' : ''} · ` : ''}
                  {v.text?.slice(0, 60) ?? new Date(v.createdAt).toLocaleString()}
                </div>
              </div>
              <div className={styles.variantActions}>
                <button
                  className={`${styles.variantIconBtn} ${v.pinned ? styles.pinned : ''}`}
                  title={v.pinned ? 'Unpin' : 'Pin'}
                  onClick={(e) => { e.stopPropagation(); pinVariant(node.id, v.id); }}
                >
                  <Pin size={12} />
                </button>
                <button
                  className={styles.variantIconBtn}
                  title="Delete version"
                  onClick={(e) => { e.stopPropagation(); removeVariant(node.id, v.id); }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'retouch' && (
        <div className={styles.deckScroll}>
          <RetouchPanel node={node} apiKey={apiKey} />
        </div>
      )}

      {tab === 'layers' && (
        <div className={styles.deckScroll}>
          {variant ? (
            <LayersPanelBody
              node={node}
              variant={variant}
              selectedLayerId={selectedLayerId}
              onSelectLayer={setSelectedLayerId}
              compact
            />
          ) : (
            <div className={styles.layerEmptyHint}>Generate or import first — layers attach to a picture.</div>
          )}
        </div>
      )}

      {tab === 'info' && (
        <div className={styles.deckScroll}>
          {variant ? (
            <VariantInfoBody node={node} variant={variant} />
          ) : (
            <div className={styles.layerEmptyHint}>No version selected.</div>
          )}
        </div>
      )}
    </div>
  );
};
