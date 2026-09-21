import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import { FolderClock, ChevronDown, Save, Trash2, Pencil, Check, X, FolderOpen } from 'lucide-react';
import { usePipelineStore, type PipelineSnapshotMeta } from '@/stores/pipelineStore';
import styles from './WorkflowMenu.module.css';

interface ProjectSummary {
  projectId: string;
  projectName: string;
  updatedAt: number;
  nodeCount: number;
  sceneCount: number;
  snapshotCount: number;
}

interface WorkflowMenuProps {
  /**
   * 'project' — inside a Workshop toolbar: shows this project's autosaved
   * draft plus named snapshots (save/load/rename/delete).
   * 'global' — on the home page: lists every project that has a saved
   * Workshop pipeline; clicking one opens that project's Workshop.
   */
  scope: 'project' | 'global';
  projectId?: string;
  projectName?: string;
  /**
   * Renders a caller-supplied trigger element instead of the default pill
   * button — used to make this fit visually into a different toolbar (e.g.
   * the home page's left panel quick-actions list). The panel still opens as
   * a positioned popover (portaled to <body>, so it's never clipped by a
   * scrolling ancestor) anchored to whatever this renders.
   */
  renderTrigger?: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const WorkflowMenu: React.FC<WorkflowMenuProps> = ({ scope, projectId, projectName, renderTrigger }) => {
  const router = useRouter();
  const triggerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const [snapshots, setSnapshots] = useState<PipelineSnapshotMeta[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingName, setSavingName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const PANEL_WIDTH = 340;

  const toggle = useCallback(() => {
    setOpen((v) => {
      const next = !v;
      if (next && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const left = Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 12);
        setPanelPos({ top: rect.bottom + 6, left: Math.max(8, left) });
      }
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (scope === 'project' && projectId) {
        const list = await usePipelineStore.getState().listSnapshots(projectId);
        setSnapshots(list);
      } else if (scope === 'global') {
        const res = await fetch('/api/workspace/pipelines');
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects ?? []);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [scope, projectId]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = triggerRef.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (!insideTrigger && !insidePanel) {
        setOpen(false);
        setShowSaveInput(false);
        setRenamingId(null);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleSave = async () => {
    if (!projectId || !savingName.trim()) return;
    await usePipelineStore.getState().saveSnapshot(projectId, projectName ?? 'Untitled', savingName.trim());
    setSavingName('');
    setShowSaveInput(false);
    void refresh();
  };

  const handleLoad = async (snapshotId: string) => {
    if (!projectId) return;
    if (!window.confirm('Load this workflow into the current Workshop? Your current draft is autosaved separately and will not be lost.')) return;
    await usePipelineStore.getState().loadSnapshot(projectId, snapshotId);
    setOpen(false);
  };

  const handleDelete = async (snapshotId: string) => {
    if (!projectId) return;
    if (!window.confirm('Delete this saved workflow? This cannot be undone.')) return;
    await usePipelineStore.getState().deleteSnapshot(projectId, snapshotId);
    void refresh();
  };

  const handleRename = async (snapshotId: string) => {
    if (!projectId || !renameValue.trim()) return;
    await usePipelineStore.getState().renameSnapshot(projectId, snapshotId, renameValue.trim());
    setRenamingId(null);
    void refresh();
  };

  const openProject = (pid: string) => {
    void router.push(`/project/${pid}?workshop=1`);
    setOpen(false);
  };

  const panel = open && panelPos && (
    createPortal(
      <div
        ref={panelRef}
        className={styles.panel}
        style={{ position: 'fixed', top: panelPos.top, left: panelPos.left, width: PANEL_WIDTH }}
      >
        {renderPanelBody()}
      </div>,
      document.body,
    )
  );

  function renderPanelBody() {
    return (
      <>
          {scope === 'project' ? (
            <>
              <div className={styles.panelHeader}>
                <span>Saved workflows{projectName ? ` — ${projectName}` : ''}</span>
                <button className={styles.smallBtn} onClick={() => setShowSaveInput((v) => !v)}>
                  <Save size={12} /> Save as…
                </button>
              </div>
              {showSaveInput && (
                <div className={styles.saveRow}>
                  <input
                    autoFocus
                    className={styles.input}
                    placeholder="Workflow name"
                    value={savingName}
                    onChange={(e) => setSavingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSave();
                      if (e.key === 'Escape') setShowSaveInput(false);
                    }}
                  />
                  <button className={styles.iconBtn} onClick={() => void handleSave()} title="Save"><Check size={13} /></button>
                  <button className={styles.iconBtn} onClick={() => setShowSaveInput(false)} title="Cancel"><X size={13} /></button>
                </div>
              )}
              {loading && <div className={styles.empty}>Loading…</div>}
              {!loading && snapshots.length === 0 && (
                <div className={styles.empty}>
                  No named snapshots yet — the current draft autosaves continuously;
                  use &ldquo;Save as…&rdquo; to keep a named copy you can always return to.
                </div>
              )}
              {[...snapshots]
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((snap) => (
                  <div key={snap.id} className={styles.row}>
                    {renamingId === snap.id ? (
                      <>
                        <input
                          autoFocus
                          className={styles.input}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleRename(snap.id);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                        />
                        <button className={styles.iconBtn} onClick={() => void handleRename(snap.id)} title="Confirm"><Check size={13} /></button>
                      </>
                    ) : (
                      <>
                        <button className={styles.rowMain} onClick={() => void handleLoad(snap.id)} title="Load this workflow">
                          <FolderOpen size={13} />
                          <span className={styles.rowName}>{snap.name}</span>
                          <span className={styles.rowMeta}>{snap.nodeCount}n · {snap.sceneCount}sc · {timeAgo(snap.updatedAt)}</span>
                        </button>
                        <button className={styles.iconBtn} onClick={() => { setRenamingId(snap.id); setRenameValue(snap.name); }} title="Rename"><Pencil size={12} /></button>
                        <button className={styles.iconBtn} onClick={() => void handleDelete(snap.id)} title="Delete"><Trash2 size={12} /></button>
                      </>
                    )}
                  </div>
                ))}
            </>
          ) : (
            <>
              <div className={styles.panelHeader}><span>Saved workflows — all projects</span></div>
              {loading && <div className={styles.empty}>Loading…</div>}
              {!loading && projects.length === 0 && (
                <div className={styles.empty}>No Workshop pipelines saved yet. Open a project&rsquo;s Workshop and add nodes — it autosaves.</div>
              )}
              {projects.map((p) => (
                <button key={p.projectId} className={styles.row} onClick={() => openProject(p.projectId)}>
                  <span className={styles.rowMain}>
                    <FolderOpen size={13} />
                    <span className={styles.rowName}>{p.projectName}</span>
                    <span className={styles.rowMeta}>
                      {p.nodeCount}n · {p.sceneCount}sc{p.snapshotCount ? ` · ${p.snapshotCount} saved` : ''} · {timeAgo(p.updatedAt)}
                    </span>
                  </span>
                </button>
              ))}
            </>
          )}
      </>
    );
  }

  return (
    <>
      <div ref={triggerRef} className={styles.wrap}>
        {renderTrigger ? (
          renderTrigger({ open, toggle })
        ) : (
          <button className={styles.trigger} onClick={toggle} title="Saved workflows (JSON)">
            <FolderClock size={15} /> Workflows <ChevronDown size={11} />
          </button>
        )}
      </div>
      {panel}
    </>
  );
};
