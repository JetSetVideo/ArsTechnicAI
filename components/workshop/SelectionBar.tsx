import React, { useEffect, useRef, useState } from 'react';
import { Boxes, Check, LogOut, Pencil, Trash2, Ungroup, X } from 'lucide-react';
import { STAGES, STAGE_ORDER } from '@/lib/pipeline/catalog';
import type { PipelineStageId } from '@/types/pipeline';
import styles from './WorkshopFlow.module.css';

/**
 * The actions for what is selected on the canvas, shown next to it.
 *
 * Replaces the stage wheel that used to open after a selection rectangle:
 * the wheel now only opens when a wire is dropped on empty canvas.
 * Every action also has a keyboard path (⌘G, ⇧⌘G, Delete, Esc).
 */
export interface SelectionBarProps {
  /** Canvas-local position of the bar's top-centre. */
  anchor: { x: number; y: number };
  mode: 'nodes' | 'group' | 'lane';
  count: number;
  /** The group's name (mode 'group'), or the shared group of the selected nodes. */
  groupTitle?: string;
  /** Selected nodes all sit in one group: offer "Remove from group". */
  inSharedGroup?: boolean;
  onGroup?: () => void;
  onUngroup?: () => void;
  onRemoveFromGroup?: () => void;
  onRename?: (title: string) => void;
  onMoveToStage?: (stage: PipelineStageId) => void;
  onDelete?: () => void;
  onClear: () => void;
}

export const SelectionBar: React.FC<SelectionBarProps> = ({
  anchor, mode, count, groupTitle, inSharedGroup,
  onGroup, onUngroup, onRemoveFromGroup, onRename, onMoveToStage, onDelete, onClear,
}) => {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(groupTitle ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(groupTitle ?? ''); setRenaming(false); }, [groupTitle, mode]);
  useEffect(() => { if (renaming) inputRef.current?.select(); }, [renaming]);

  const commit = () => {
    const clean = draft.trim();
    if (clean && clean !== groupTitle) onRename?.(clean);
    setRenaming(false);
  };

  const label = mode === 'group'
    ? (groupTitle || 'Group')
    : mode === 'lane'
      ? (groupTitle || 'Stage')
      : `${count} node${count === 1 ? '' : 's'}`;

  return (
    <div
      className={styles.selectionBar}
      data-canvas-overlay
      role="toolbar"
      aria-label={`Actions for ${label}`}
      style={{ left: anchor.x, top: anchor.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {renaming ? (
        <form
          className={styles.selectionRename}
          onSubmit={(event) => { event.preventDefault(); commit(); }}
        >
          <input
            ref={inputRef}
            className={styles.selectionRenameInput}
            value={draft}
            aria-label="Group name"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Escape') { event.stopPropagation(); setDraft(groupTitle ?? ''); setRenaming(false); }
            }}
          />
          <button type="submit" className={styles.selectionBtn} aria-label="Save name" title="Save name (Enter)">
            <Check size={14} />
          </button>
        </form>
      ) : (
        <span className={styles.selectionLabel} title={label}>{label}</span>
      )}

      {mode === 'nodes' && onGroup && (
        <button type="button" className={styles.selectionBtn} onClick={onGroup} title="Group the selection (⌘G)" aria-label="Group the selection">
          <Boxes size={14} /><span className={styles.selectionBtnText}>Group</span>
        </button>
      )}
      {mode === 'nodes' && inSharedGroup && onRemoveFromGroup && (
        <button type="button" className={styles.selectionBtn} onClick={onRemoveFromGroup} title="Take the selection out of its group" aria-label="Remove from group">
          <LogOut size={14} /><span className={styles.selectionBtnText}>Remove from group</span>
        </button>
      )}
      {mode === 'group' && onRename && !renaming && (
        <button type="button" className={styles.selectionBtn} onClick={() => setRenaming(true)} title="Rename the group" aria-label="Rename the group">
          <Pencil size={14} /><span className={styles.selectionBtnText}>Rename</span>
        </button>
      )}
      {mode === 'group' && onUngroup && (
        <button type="button" className={styles.selectionBtn} onClick={onUngroup} title="Ungroup — the cards stay (⇧⌘G)" aria-label="Ungroup">
          <Ungroup size={14} /><span className={styles.selectionBtnText}>Ungroup</span>
        </button>
      )}
      {mode === 'nodes' && onMoveToStage && (
        <select
          className={styles.selectionSelect}
          aria-label="Move the selection into a stage lane"
          value=""
          onChange={(event) => { if (event.target.value) onMoveToStage(event.target.value as PipelineStageId); }}
        >
          <option value="">Move to lane…</option>
          {STAGE_ORDER.map((stage) => <option key={stage} value={stage}>{STAGES[stage].title}</option>)}
        </select>
      )}
      {onDelete && (
        <button type="button" className={`${styles.selectionBtn} ${styles.selectionDanger}`} onClick={onDelete} title="Delete (Delete key)" aria-label={`Delete ${label}`}>
          <Trash2 size={14} />
        </button>
      )}
      <button type="button" className={styles.selectionBtn} onClick={onClear} title="Clear the selection (Esc)" aria-label="Clear the selection">
        <X size={14} />
      </button>
    </div>
  );
};
