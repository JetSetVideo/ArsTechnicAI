import React, { useEffect, useRef, useState } from 'react';
import {
  Film, ChevronLeft, ChevronRight, X, ChevronDown, ChevronUp, Clapperboard, Plus,
} from 'lucide-react';
import { usePipelineStore } from '@/stores/pipelineStore';
import { TRANSITIONS } from '@/lib/pipeline/catalog';
import styles from './WorkshopFlow.module.css';

/**
 * The film strip: the ordered scenes of the final video. Pictures can be
 * added directly from the "+ Add scene" picker here, or from any node's
 * Info tab ("Add to film") — then reordered, timed, and given transitions.
 * This is the montage order fed to the Sequence/Delivery stages.
 */
export const SceneStrip: React.FC = () => {
  const { scenes, stripOpen, toggleStrip, nodes, removeScene, moveScene, updateScene, select, addSceneFromNode } = usePipelineStore();
  const [showAdd, setShowAdd] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  const totalSeconds = scenes.reduce((acc, s) => acc + (s.duration || 0), 0);

  const resolveImage = (nodeId: string, variantId: string): string | undefined => {
    const node = nodes.find((n) => n.id === nodeId);
    const variant = node?.variants.find((v) => v.id === variantId) ?? node?.variants[0];
    return variant?.image;
  };

  // Nodes with a pictured result — the only valid "+ Add scene" candidates
  const candidateNodes = nodes.filter((n) => {
    const v = n.variants.find((vv) => vv.id === n.activeVariantId) ?? n.variants[0];
    return !!v?.image;
  });

  useEffect(() => {
    if (!showAdd) return;
    const onClick = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setShowAdd(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showAdd]);

  return (
    <div className={`${styles.sceneStrip} ${stripOpen ? '' : styles.sceneStripClosed}`}>
      <div className={styles.sceneStripHeaderRow}>
        <button className={styles.sceneStripHeader} onClick={toggleStrip}>
          <Film size={13} />
          <b>Film order</b>
          <span className={styles.sceneStripMeta}>
            {scenes.length} scene{scenes.length === 1 ? '' : 's'} · {totalSeconds.toFixed(1)}s
          </span>
          {stripOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
        {stripOpen && (
          <div ref={addRef} className={styles.sceneAddWrap}>
            <button
              className={styles.sceneAddBtn}
              onClick={() => setShowAdd((v) => !v)}
              title="Add a scene from a node's current result"
            >
              <Plus size={12} /> Add scene
            </button>
            {showAdd && (
              <div className={styles.sceneAddMenu}>
                {candidateNodes.length === 0 ? (
                  <div className={styles.sceneAddEmpty}>
                    No generated pictures yet — run a node first, then add its result here.
                  </div>
                ) : (
                  candidateNodes.map((n) => {
                    const v = n.variants.find((vv) => vv.id === n.activeVariantId) ?? n.variants[0];
                    return (
                      <button
                        key={n.id}
                        className={styles.sceneAddItem}
                        onClick={() => { addSceneFromNode(n.id); setShowAdd(false); }}
                      >
                        {v?.image && <img src={v.image} alt="" />}
                        <span>{n.title} · v{v?.version ?? 1}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {stripOpen && (
        <div className={styles.sceneStripBody}>
          {scenes.length === 0 && (
            <div className={styles.sceneStripEmpty}>
              <Clapperboard size={14} />
              Click <b>+ Add scene</b> above, or add pictures from any node's <b>Info</b> tab
              (“Add to film”) — then order, time, and cut them.
            </div>
          )}
          {scenes.map((scene, i) => {
            const img = resolveImage(scene.nodeId, scene.variantId);
            return (
              <div key={scene.id} className={styles.sceneCard}>
                <div className={styles.sceneIndex}>{i + 1}</div>
                <div
                  className={styles.sceneThumb}
                  onClick={() => select(scene.nodeId)}
                  title={`${scene.label} — click to select its node`}
                >
                  {img ? <img src={img} alt={scene.label} /> : <Film size={14} />}
                </div>
                <div className={styles.sceneControls}>
                  <span className={styles.sceneLabel}>{scene.label}</span>
                  <div className={styles.sceneRow}>
                    <input
                      type="number"
                      className={styles.sceneDuration}
                      min={0.2}
                      step={0.1}
                      value={scene.duration}
                      title="Seconds on screen"
                      onChange={(e) => updateScene(scene.id, { duration: Number(e.target.value) })}
                    />
                    <span className={styles.sceneUnit}>s</span>
                    <select
                      className={styles.sceneTransition}
                      value={scene.transition}
                      title="Transition to next scene"
                      onChange={(e) => updateScene(scene.id, { transition: e.target.value })}
                    >
                      {TRANSITIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className={styles.sceneActions}>
                  <button className={styles.layerIconBtn} title="Earlier" disabled={i === 0}
                    onClick={() => moveScene(scene.id, -1)}>
                    <ChevronLeft size={12} />
                  </button>
                  <button className={styles.layerIconBtn} title="Later" disabled={i === scenes.length - 1}
                    onClick={() => moveScene(scene.id, 1)}>
                    <ChevronRight size={12} />
                  </button>
                  <button className={styles.layerIconBtn} title="Remove from film"
                    onClick={() => removeScene(scene.id)}>
                    <X size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
