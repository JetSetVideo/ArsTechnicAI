import React from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void; icon?: React.ReactNode };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, body, action, className }) => (
  <div id="empty-state-centered-panel" className={`${styles.emptyState} ${className ?? ''}`}>
    <div className={styles.emptyStateIcon}>{icon}</div>
    <p className={styles.emptyStateTitle}>{title}</p>
    {body && <p className={styles.emptyStateBody}>{body}</p>}
    {action && (
      <button className={styles.emptyStateAction} onClick={action.onClick}>
        {action.icon}
        {action.label}
      </button>
    )}
  </div>
);
