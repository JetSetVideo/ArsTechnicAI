import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import {
  STARTER_BLUEPRINTS,
  WORKFLOW_GROUPS,
  graphToBlueprint,
  inferCategory,
  workflowIcon,
  type BlueprintSpec,
  type WorkflowGroup,
} from '@/lib/pipeline/blueprintBridge';
import { PIPELINE_NODE_DEFS } from '@/lib/pipeline/catalog';
import { nodeIcon } from './PipelineNodeCard';
import { useBlueprintStore } from '@/stores/blueprintStore';
import { usePipelineStore, type PipelineSnapshotMeta } from '@/stores/pipelineStore';
import styles from './WorkflowPicker.module.css';

const SPEC_ONLY = new Set([
  'image-to-video',
  'dialogue-tts',
  'music-gen',
  'sfx-gen',
  'frame-interpolate',
  'stabilize',
  'transcode',
  'animatic',
  'palette-extract',
  'audio-mix',
  'sequence',
  'format-profile',
  'publish',
  'caption-style',
  'overlay-text',
]);

const STARTER_IDS = new Set(STARTER_BLUEPRINTS.map((spec) => spec.id));

export type WorkflowReadiness = 'generates' | 'needs-file' | 'mixed';
export type PlaceMode = 'replace' | 'insert';

export function workflowReadiness(spec: BlueprintSpec): WorkflowReadiness {
  const execs = spec.nodes.map((node) => PIPELINE_NODE_DEFS[node.type]?.execution);
  const mixed = spec.nodes.some((node) => SPEC_ONLY.has(node.type))
    || execs.some((execution) => execution === 'manual' || execution === 'local' || execution === 'compose');
  if (mixed) return 'mixed';
  if (execs.includes('import')) return 'needs-file';
  return 'generates';
}

function badge(spec: BlueprintSpec): { tone: 'generates' | 'needsFile' | 'mixed'; label: string } {
  const readiness = workflowReadiness(spec);
  if (readiness === 'generates') return { tone: 'generates', label: 'Generates' };
  if (readiness === 'mixed') return { tone: 'mixed', label: 'Mixed' };
  const types = new Set(spec.nodes.map((node) => node.type));
  if (types.has('script-import') && !types.has('image-import')) {
    return { tone: 'needsFile', label: 'Needs your script' };
  }
  return { tone: 'needsFile', label: 'Needs your picture' };
}

function chain(spec: BlueprintSpec): string {
  return spec.nodes
    .map((node) => PIPELINE_NODE_DEFS[node.type]?.title ?? node.type)
    .join(' → ');
}

function timeAgo(ts: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

type Tab = 'library' | 'project' | 'saved';

interface WorkflowPickerProps {
  projectId: string;
  projectName: string;
  nodeCount: number;
  onClose: () => void;
  onApply: (spec: BlueprintSpec, mode: PlaceMode) => void;
  onApplySaved: (id: string, mode: PlaceMode) => void;
  onFullPipeline: (mode: PlaceMode) => void;
  onLoadedSnapshot: () => void;
}

export const WorkflowPicker: React.FC<WorkflowPickerProps> = ({
  projectId,
  projectName,
  nodeCount,
  onClose,
  onApply,
  onApplySaved,
  onFullPipeline,
  onLoadedSnapshot,
}) => {
  const [tab, setTab] = useState<Tab>('library');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<WorkflowGroup | 'all'>('all');
  const [showReport, setShowReport] = useState(false);
  const [place, setPlace] = useState<PlaceMode>(nodeCount > 0 ? 'insert' : 'replace');
  const [snapshots, setSnapshots] = useState<PipelineSnapshotMeta[]>([]);
  const [loadingSnaps, setLoadingSnaps] = useState(false);
  const [savingName, setSavingName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [graphName, setGraphName] = useState('');
  const blueprints = useBlueprintStore((s) => s.blueprints);
  const mode: PlaceMode = nodeCount === 0 ? 'replace' : place;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (tab !== 'project') return;
    let cancelled = false;
    setLoadingSnaps(true);
    void usePipelineStore.getState().listSnapshots(projectId).then((list) => {
      if (!cancelled) {
        setSnapshots(list);
        setLoadingSnaps(false);
      }
    });
    return () => { cancelled = true; };
  }, [tab, projectId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return STARTER_BLUEPRINTS.filter((spec) => {
      if (group !== 'all' && spec.card.group !== group) return false;
      if (!q) return true;
      const titles = spec.nodes.map((node) => PIPELINE_NODE_DEFS[node.type]?.title ?? '').join(' ');
      return `${spec.name} ${spec.card.summary} ${spec.card.honesty} ${titles}`.toLowerCase().includes(q);
    });
  }, [query, group]);

  const mine = blueprints.filter((bp) => !STARTER_IDS.has(bp.id));

  const refreshSnaps = async () => {
    const list = await usePipelineStore.getState().listSnapshots(projectId);
    setSnapshots(list);
  };

  const saveSnapshot = async () => {
    if (!savingName.trim() || nodeCount === 0) return;
    await usePipelineStore.getState().saveSnapshot(projectId, projectName, savingName.trim());
    setSavingName('');
    await refreshSnaps();
  };

  const saveGraph = () => {
    if (!graphName.trim() || nodeCount === 0) return;
    const { nodes, edges } = usePipelineStore.getState();
    const bp = graphToBlueprint(nodes, edges, {
      name: graphName.trim(),
      category: inferCategory(nodes),
      description: 'Saved from the workshop.',
    });
    useBlueprintStore.getState().addBlueprint(bp);
    setGraphName('');
  };

  const body = (
    <div className={styles.backdrop} onPointerDown={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workflow-picker-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2 id="workflow-picker-title">Workflows</h2>
            <p>
              Starting graphs, copies saved in {(projectName || 'this project').trim()}, and graphs you name yourself.
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className={styles.tabs}>
          <button type="button" className={tab === 'library' ? styles.tabOn : styles.tab} onClick={() => setTab('library')}>
            Library <span>{STARTER_BLUEPRINTS.length}</span>
          </button>
          <button type="button" className={tab === 'project' ? styles.tabOn : styles.tab} onClick={() => setTab('project')}>
            This project
          </button>
          <button type="button" className={tab === 'saved' ? styles.tabOn : styles.tab} onClick={() => setTab('saved')}>
            Saved graphs <span>{mine.length}</span>
          </button>
        </div>

        {nodeCount > 0 && tab !== 'project' && (
          <div className={styles.placeBar}>
            <span>The canvas has {nodeCount} node{nodeCount === 1 ? '' : 's'}.</span>
            <button type="button" className={place === 'insert' ? styles.filterOn : styles.filter} onClick={() => setPlace('insert')}>
              Add beside
            </button>
            <button type="button" className={place === 'replace' ? styles.filterOn : styles.filter} onClick={() => setPlace('replace')}>
              Replace canvas
            </button>
          </div>
        )}

        {tab === 'library' && (
          <>
            <button type="button" className={styles.featured} onClick={() => onFullPipeline(mode)}>
              <span className={styles.featuredKicker}>Full startup pipeline</span>
              <strong>Moodboard through delivery</strong>
              <span className={styles.featuredBody}>
                Moodboard, style, logline, script, prompt lab, sketch, breakdown, character, sheet,
                location, shot list, storyboard, key visual, edit, animate, dialogue, music, mix,
                sequence, subtitles, and a format profile.
              </span>
              <span className={styles.honesty}>
                Image and text nodes call the model. Style DNA, Character, and Location are forms.
                Animate, dialogue, music, mix, sequence, and format write directions and sheets.
              </span>
              <span className={`${styles.chip} ${styles.mixed}`}>Mixed</span>
            </button>

            <div className={styles.tools}>
              <input
                className={styles.search}
                value={query}
                placeholder="Search — background, weather, board, cover…"
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
              />
              <div className={styles.filters}>
                <button type="button" className={group === 'all' ? styles.filterOn : styles.filter} onClick={() => setGroup('all')}>
                  All {STARTER_BLUEPRINTS.length}
                </button>
                {WORKFLOW_GROUPS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={group === item.id ? styles.filterOn : styles.filter}
                    onClick={() => setGroup(item.id)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>

            {WORKFLOW_GROUPS.filter((item) => group === 'all' || group === item.id).map((item) => {
              const cards = visible.filter((spec) => spec.card.group === item.id);
              if (cards.length === 0) return null;
              return (
                <section key={item.id} className={styles.section}>
                  <div className={styles.sectionHead}>
                    <h3>{item.title}</h3>
                    <p>{item.blurb}</p>
                  </div>
                  <div className={styles.grid}>
                    {cards.map((spec) => {
                      const mark = badge(spec);
                      return (
                        <button key={spec.id} type="button" className={styles.card} onClick={() => onApply(spec, mode)}>
                          <span className={styles.shot}>
                            <img src={spec.card.image} alt="" />
                          </span>
                          <span className={styles.cardBody}>
                            <span className={styles.cardTop}>
                              <span className={styles.cardIcon}>{nodeIcon(workflowIcon(spec.id), 14)}</span>
                              <strong>{spec.name}</strong>
                              <span className={`${styles.chip} ${styles[mark.tone]}`}>{mark.label}</span>
                            </span>
                            <span className={styles.summary}>{spec.card.summary}</span>
                            <span className={styles.chain}>{chain(spec)}</span>
                            <span className={styles.honesty}>{spec.card.honesty}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {visible.length === 0 && <p className={styles.empty}>Nothing matches that search.</p>}

            <button type="button" className={styles.reportToggle} onClick={() => setShowReport((value) => !value)}>
              {showReport ? 'Hide' : 'Show'} which nodes actually run
            </button>
            {showReport && (
              <div className={styles.report}>
                <div>
                  <h4>These generate</h4>
                  <p>Moodboard, sketch, key visual, AI edit, upscale, color grade, character sheet, location plates, prop design, storyboard frame, thumbnail. Logline, script, prompt lab, shot list, and scene breakdown write text.</p>
                </div>
                <div>
                  <h4>These are forms</h4>
                  <p>Style DNA, Character, and Location store what you type. Downstream image prompts do not all read Style DNA yet. Character Sheet does read the character bible.</p>
                </div>
                <div>
                  <h4>These write a spec</h4>
                  <p>Animate Image returns another still. Dialogue, music, and sound effects write briefs. Mix writes a sheet. Sequence writes an edit list. Format, transcode, stabilize, and interpolate store settings. Palette stores swatches; it does not sample the picture.</p>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'project' && (
          <div className={styles.saved}>
            <p className={styles.lead}>
              Named copies of this project’s canvas. The live draft autosaves on its own.
              Loading a copy replaces what is on the canvas now.
            </p>
            <div className={styles.saveRow}>
              <input
                className={styles.input}
                placeholder={nodeCount === 0 ? 'Add nodes before saving' : 'Name this copy'}
                value={savingName}
                disabled={nodeCount === 0}
                onChange={(event) => setSavingName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void saveSnapshot();
                }}
              />
              <button type="button" className={styles.smallBtn} disabled={nodeCount === 0 || !savingName.trim()} onClick={() => void saveSnapshot()}>
                Save copy
              </button>
            </div>
            {loadingSnaps && <p className={styles.empty}>Loading…</p>}
            {!loadingSnaps && snapshots.length === 0 && (
              <p className={styles.empty}>No named copies yet.</p>
            )}
            {[...snapshots].sort((a, b) => b.updatedAt - a.updatedAt).map((snap) => (
              <div key={snap.id} className={styles.savedRow}>
                {renamingId === snap.id ? (
                  <>
                    <input
                      className={styles.input}
                      value={renameValue}
                      autoFocus
                      onChange={(event) => setRenameValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          void usePipelineStore.getState().renameSnapshot(projectId, snap.id, renameValue.trim()).then(refreshSnaps);
                          setRenamingId(null);
                        }
                        if (event.key === 'Escape') setRenamingId(null);
                      }}
                    />
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label="Confirm rename"
                      onClick={() => {
                        void usePipelineStore.getState().renameSnapshot(projectId, snap.id, renameValue.trim()).then(refreshSnaps);
                        setRenamingId(null);
                      }}
                    >
                      <Check size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.savedMain}
                      onClick={() => {
                        if (nodeCount > 0 && !window.confirm(`Replace the canvas with “${snap.name}”?`)) return;
                        void usePipelineStore.getState().loadSnapshot(projectId, snap.id).then(() => onLoadedSnapshot());
                      }}
                    >
                      <strong>{snap.name}</strong>
                      <span>{snap.nodeCount} nodes · {snap.sceneCount} scenes · {timeAgo(snap.updatedAt)}</span>
                    </button>
                    <button type="button" className={styles.iconBtn} aria-label="Rename" onClick={() => { setRenamingId(snap.id); setRenameValue(snap.name); }}>
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label="Delete"
                      onClick={() => {
                        if (!window.confirm(`Delete “${snap.name}”?`)) return;
                        void usePipelineStore.getState().deleteSnapshot(projectId, snap.id).then(refreshSnaps);
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'saved' && (
          <div className={styles.saved}>
            <p className={styles.lead}>
              Graphs you saved from a canvas. The library above is the built-in set, so it is not listed again here.
            </p>
            <div className={styles.saveRow}>
              <input
                className={styles.input}
                placeholder={nodeCount === 0 ? 'Add nodes before saving' : 'Name the canvas'}
                value={graphName}
                disabled={nodeCount === 0}
                onChange={(event) => setGraphName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') saveGraph();
                }}
              />
              <button type="button" className={styles.smallBtn} disabled={nodeCount === 0 || !graphName.trim()} onClick={saveGraph}>
                Save graph
              </button>
            </div>
            {mine.length === 0 && <p className={styles.empty}>No graphs saved from a canvas yet.</p>}
            {mine.map((bp) => (
              <div key={bp.id} className={styles.savedRow}>
                <button type="button" className={styles.savedMain} onClick={() => onApplySaved(bp.id, mode)}>
                  <strong>{bp.name}</strong>
                  <span>{bp.nodes.length} nodes{bp.description ? ` · ${bp.description}` : ''}</span>
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label="Delete graph"
                  onClick={() => {
                    if (!window.confirm(`Delete “${bp.name}”?`)) return;
                    useBlueprintStore.getState().removeBlueprint(bp.id);
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(body, document.body);
};
