import React, { useState } from 'react';
import { History, ChevronDown, ChevronUp, Trash2, X, CheckCircle, XCircle, Clock, Sparkles, FolderPlus, Image, Move, Settings, Search, Undo2 } from 'lucide-react';
import { usePipelineStore } from '@/stores/pipelineStore';
import { Button } from '../ui/Button';
import { useLogStore } from '@/stores';
import styles from './ActionLog.module.css';
import type { ActionLogEntry } from '@/types';

const formatTimestamp = (ts: number) => {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  // Show relative time for recent actions
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getActionConfig = (type: ActionLogEntry['type']): { icon: React.ReactNode; color: string; label: string } => {
  switch (type) {
    case 'generation_start':
      return { icon: <Clock size={12} />, color: 'var(--accent-tertiary)', label: 'GEN' };
    case 'generation_complete':
      return { icon: <CheckCircle size={12} />, color: 'var(--success-solid)', label: 'GEN' };
    case 'generation_fail':
      return { icon: <XCircle size={12} />, color: 'var(--error-solid)', label: 'ERR' };
    case 'file_import':
      return { icon: <FolderPlus size={12} />, color: 'var(--info-solid)', label: 'IMP' };
    case 'file_export':
      return { icon: <Image size={12} />, color: 'var(--info-solid)', label: 'EXP' };
    case 'canvas_add':
      return { icon: <Image size={12} />, color: 'var(--accent-primary)', label: 'ADD' };
    case 'canvas_remove':
      return { icon: <Trash2 size={12} />, color: 'var(--error-solid)', label: 'DEL' };
    case 'canvas_move':
    case 'canvas_resize':
      return { icon: <Move size={12} />, color: 'var(--text-secondary)', label: 'MOV' };
    case 'settings_change':
      return { icon: <Settings size={12} />, color: 'var(--accent-secondary)', label: 'SET' };
    case 'search':
      return { icon: <Search size={12} />, color: 'var(--text-secondary)', label: 'Search' };
    case 'workshop_edit':
      return { icon: <Undo2 size={12} />, color: 'var(--accent-primary)', label: 'Edit' };
    case 'prompt_save':
      return { icon: <Sparkles size={12} />, color: 'var(--accent-primary)', label: 'PRM' };
    default:
      return { icon: <History size={12} />, color: 'var(--text-muted)', label: 'LOG' };
  }
};

// Format data parameters in a compact way
const formatParams = (data?: Record<string, unknown>): string[] => {
  if (!data) return [];
  
  const params: string[] = [];
  
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    
    let displayValue: string;
    
    if (typeof value === 'string') {
      // Truncate long strings
      displayValue = value.length > 30 ? `${value.slice(0, 27)}...` : value;
    } else if (typeof value === 'number') {
      displayValue = value.toString();
    } else if (Array.isArray(value)) {
      displayValue = `[${value.length}]`;
    } else if (typeof value === 'object') {
      displayValue = '{...}';
    } else {
      displayValue = String(value);
    }
    
    // Format key: camelCase to readable
    const readableKey = key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
    params.push(`${readableKey}: ${displayValue}`);
  }
  
  return params.slice(0, 4); // Max 4 params
};

interface ActionEntryProps {
  entry: ActionLogEntry;
}

const ActionEntry: React.FC<ActionEntryProps & { canReturn?: boolean }> = ({ entry, canReturn }) => {
  const config = getActionConfig(entry.type);
  const returned = entry.data?.undone === true;

  if (entry.isDigest) {
    const samples = (entry.data?.samples as { description: string }[] | undefined) ?? [];
    return (
      <div className={`${styles.entry} ${styles.digestEntry}`} title={samples.map((s) => s.description).join('\n')}>
        <div className={styles.entryHeader}>
          <span className={styles.entryBadge} style={{ background: 'var(--text-muted)' }}>
            {config.icon}
            <span>{entry.digestCount}×</span>
          </span>
          <span className={styles.entryTime}>{formatTimestamp(entry.timestamp)}</span>
        </div>
        <div className={styles.entryDescription}>{entry.description}</div>
      </div>
    );
  }

  const params = entry.type === 'search' ? [] : formatParams(entry.data);

  return (
    <div className={`${styles.entry} ${returned ? styles.returned : ''}`}>
      <div className={styles.entryHeader}>
        <span className={styles.entryBadge} style={{ background: config.color }}>
          {config.icon}
          <span>{returned ? 'Returned' : config.label}</span>
        </span>
        <span className={styles.entryTime}>{formatTimestamp(entry.timestamp)}</span>
        {canReturn && (
          <button
            type="button"
            className={styles.returnBtn}
            title="Return this edit"
            onClick={() => usePipelineStore.getState().undo()}
          >
            <Undo2 size={12} />
          </button>
        )}
      </div>
      <div className={styles.entryDescription}>{entry.description}</div>
      {params.length > 0 && (
        <div className={styles.entryParams}>
          {params.map((param, idx) => (
            <span key={idx} className={styles.param}>{param}</span>
          ))}
        </div>
      )}
    </div>
  );
};

export const ActionLog: React.FC = () => {
  const { clearLog, getEntriesForCurrentProject } = useLogStore();
  // Subscribe to the raw entries so this re-renders when new/compressed
  // entries land, then derive the current project's slice from them.
  useLogStore((s) => s.entries);
  const [isOpen, setIsOpen] = useState(false);
  const [showOther, setShowOther] = useState(false);
  usePipelineStore((s) => s.undoDepth);

  const projectEntries = getEntriesForCurrentProject();
  const edits = projectEntries.filter((entry) => entry.type === 'workshop_edit');
  const other = projectEntries.filter((entry) => entry.type !== 'workshop_edit');
  const returnable = edits.filter((entry) => entry.data?.undone !== true);
  const headId = returnable[0]?.id;

  if (!isOpen) {
    return (
      <button
        className={styles.toggleButton}
        onClick={() => setIsOpen(true)}
        title="History"
        type="button"
      >
        <History size={16} />
        {returnable.length > 0 && (
          <span className={styles.badge}>{returnable.length}</span>
        )}
      </button>
    );
  }

  return (
    <div className={styles.actionLog}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <History size={14} />
          <span>History</span>
          <span className={styles.count}>{returnable.length}</span>
        </div>
        <div className={styles.headerRight}>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearLog}
            title="Clear log"
          >
            <Trash2 size={12} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            title="Close"
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      <div className={styles.entries}>
        {edits.length === 0 && other.length === 0 ? (
          <div className={styles.empty}>
            <History size={24} />
            <p>Nothing to return</p>
            <span>Workshop edits land here, in the same order as Undo.</span>
          </div>
        ) : (
          <>
            {edits.map((entry) => (
              <ActionEntry key={entry.id} entry={entry} canReturn={entry.id === headId} />
            ))}
            {other.length > 0 && (
              <button
                className={styles.expandButton}
                onClick={() => setShowOther((open) => !open)}
                type="button"
              >
                {showOther ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Other activity ({other.length})
              </button>
            )}
            {showOther && other.slice(0, 12).map((entry) => (
              <ActionEntry key={entry.id} entry={entry} />
            ))}
          </>
        )}
      </div>
    </div>
  );
};
