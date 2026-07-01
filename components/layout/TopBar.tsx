import React, { useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Settings,
  Save,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { SearchBar } from '../ui/SearchBar';
import { useLogStore, useProjectStore } from '@/stores';
import { useToastStore } from '@/stores/toastStore';
import { useProjectSync, saveProjectWorkspaceState } from '@/hooks/useProjectSync';
import { saveToDisk } from '@/hooks/useDiskSave';
import styles from './TopBar.module.css';
import type { SearchScope } from '@/types';

interface TopBarProps {
  onOpenSettings: () => void;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  moduleActions?: React.ReactNode;
}

function formatRelative(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenSettings,
  projectName,
  onProjectNameChange,
  moduleActions,
}) => {
  const { data: session } = useSession();
  const log = useLogStore((s) => s.log);
  const { projectId, setProject } = useProjectStore();
  const toast = useToastStore();
  const [actionLoading, setActionLoading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(projectName);

  const { saveVersion, isSaving, lastSaved } = useProjectSync(projectId);
  const isAuthenticated = !!session?.user;

  // Sync local name when prop changes
  useEffect(() => {
    setLocalName(projectName);
  }, [projectName]);

  // Cmd+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, projectName, isAuthenticated]);

  const handleSearch = useCallback(
    (query: string, scope: SearchScope) => {
      log('search', `Searched for "${query}" in ${scope}`, { query, scope });
      if (scope === 'google' || scope === 'all') {
        window.open(
          `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`,
          '_blank'
        );
      }
    },
    [log]
  );

  const handleSave = useCallback(async () => {
    setActionLoading(true);

    // Always save to localStorage + disk (works offline, no auth needed)
    try {
      saveProjectWorkspaceState(projectId || '', projectName);
      await saveToDisk();
      log('project_save', `Saved locally: ${projectName}`);
    } catch {
      log('project_save', 'Local save failed');
    }

    // Cloud save requires authentication
    if (isAuthenticated) {
      try {
        if (!projectId) {
          const res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: projectName }),
          });
          if (res.ok) {
            const { data } = await res.json();
            setProject(data.id, data.name);
            onProjectNameChange(data.name);
            await saveVersion('MANUAL', 'Initial save');
            log('project_save', `Created & saved to cloud: ${data.name}`);
          }
        } else {
          await Promise.all([
            fetch(`/api/projects/${projectId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: projectName }),
            }),
            saveVersion('MANUAL', 'Manual save'),
          ]);
          log('project_save', `Saved to cloud: ${projectName}`);
        }
      } catch {
        log('project_save', 'Cloud save failed (local save OK)');
      }
    }

    setActionLoading(false);
    toast.addToast({ type: 'success', title: 'Saved', message: isAuthenticated ? 'Project saved locally and to cloud.' : 'Project saved locally.', duration: 2500 });
  }, [projectId, projectName, isAuthenticated, saveVersion, log, onProjectNameChange, setProject, toast]);

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (localName.trim() && localName !== projectName) {
      onProjectNameChange(localName.trim());
    } else {
      setLocalName(projectName);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameBlur();
    }
  };

  return (
    <header id="topbar-app-header-workspace" className={styles.topBar}>
      {/* Left section - Logo, Breadcrumbs, Save, Search */}
      <div id="topbar-section-left-brand-nav" className={styles.section}>
        <Link href="/home" className={styles.homeLink} title="Back to Dashboard">
          <div className={styles.logo}>
            <span className={styles.logoArs}>Ars</span>
            <span className={styles.logoTechnic}>Technic</span>
            <span className={styles.logoAI}>AI</span>
          </div>
        </Link>
        
        <ChevronRight size={14} className={styles.breadcrumbSeparator} />
        
        <div className={styles.projectNameContainer}>
          {isEditingName ? (
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              className={styles.projectNameInput}
              autoFocus
            />
          ) : (
            <span 
              className={styles.projectNameDisplay} 
              onClick={() => setIsEditingName(true)}
              title="Click to rename"
            >
              {projectName}
            </span>
          )}
        </div>

        <div className={styles.divider} />

        {/* Save button */}
        <button
          className={`${styles.actionButton} ${(isSaving || actionLoading) ? styles.saving : ''}`}
          onClick={handleSave}
          title={lastSaved ? `Last saved ${formatRelative(lastSaved.toISOString())}` : 'Save'}
          disabled={isSaving || actionLoading}
        >
          {isSaving || actionLoading ? (
            <Loader2 size={16} className={styles.spin} />
          ) : (
            <Save size={16} />
          )}
        </button>

        <div className={styles.searchWrapper}>
          <SearchBar onSearch={handleSearch} placeholder="Search files..." />
        </div>

        {/* Settings button */}
        <button
          className={styles.actionButton}
          onClick={onOpenSettings}
          title="Settings (⌘,)"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Right section - Module actions */}
      <div id="topbar-section-right-modes-account" className={styles.section}>
        {moduleActions}
      </div>
    </header>
  );
};
