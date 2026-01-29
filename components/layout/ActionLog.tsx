import React, { useState } from 'react';
import { History, ChevronDown, ChevronUp, Trash2, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useLogStore } from '@/stores';
import styles from './ActionLog.module.css';
import type { ActionLogEntry } from '@/types';

const formatTimestamp = (ts: number) => {
  const date = new Date(ts);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getActionIcon = (type: ActionLogEntry['type']) => {
  switch (type) {
    case 'generation_start':
    case 'generation_complete':
    case 'generation_fail':
      return '✨';
    case 'file_import':
    case 'file_export':
      return '📁';
    case 'canvas_add':
    case 'canvas_remove':
    case 'canvas_move':
      return '🎨';
    case 'settings_change':
      return '⚙️';
    case 'search':
      return '🔍';
    default:
      return '📝';
  }
};

export const ActionLog: React.FC = () => {
  const { entries, clearLog } = useLogStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const recentEntries = isExpanded ? entries : entries.slice(0, 10);

  if (!isOpen) {
    return (
      <button
        className={styles.toggleButton}
        onClick={() => setIsOpen(true)}
        title="Show action log"
      >
        <History size={16} />
        {entries.length > 0 && (
          <span className={styles.badge}>{entries.length}</span>
        )}
      </button>
    );
  }

  return (
    <div className={styles.actionLog}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <History size={14} />
          <span>Action Log</span>
          <span className={styles.count}>({entries.length})</span>
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
        {recentEntries.length === 0 ? (
          <div className={styles.empty}>No actions recorded yet</div>
        ) : (
          recentEntries.map((entry) => (
            <div key={entry.id} className={styles.entry}>
              <span className={styles.entryIcon}>
                {getActionIcon(entry.type)}
              </span>
              <div className={styles.entryContent}>
                <span className={styles.entryDescription}>
                  {entry.description}
                </span>
                <span className={styles.entryTime}>
                  {formatTimestamp(entry.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {entries.length > 10 && (
        <button
          className={styles.expandButton}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronUp size={14} />
              Show less
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              Show all ({entries.length})
            </>
          )}
        </button>
      )}
    </div>
  );
};
