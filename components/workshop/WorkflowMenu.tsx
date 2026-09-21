import React, { useCallback, useEffect, useRef, useState } from 'react';
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
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const WorkflowMenu: React.FC<WorkflowMenuProps> = ({ scope, projectId, projectName }) => {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<PipelineSnapshotMeta[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingName, setSavingName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

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

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
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

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button className={styles.trigger} onClick={() => setOpen((v) => !v)} title="Saved workflows (JSON)">
        <FolderClock size={15} /> Workflows <ChevronDown size={11} />
      </button>
      {open && (
        <div className={styles.panel}>
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
        </div>
      )}
    </div>
  );
};
