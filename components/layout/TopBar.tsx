import React, { useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Settings,
  Save,
  Loader2,
  ChevronRight,
  ChevronDown,
  Pencil,
  Copy,
  Download,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { SearchBar } from '../ui/SearchBar';
import { useLogStore, useProjectStore, useProjectsStore } from '@/stores';
import { STORAGE_KEYS } from '@/constants/workspace';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();

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
    if (e.key === 'Enter') handleNameBlur();
    if (e.key === 'Escape') { setIsEditingName(false); setLocalName(projectName); }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const handleSaveAs = useCallback(() => {
    const name = window.prompt('Save project as', `${projectName} copy`);
    if (!name?.trim() || !projectId) return;
    const copy = useProjectsStore.getState().duplicateProject(projectId);
    if (!copy) {
      toast.addToast({ type: 'error', title: 'Save as failed', message: 'This project is not in the local list yet.', duration: 3000 });
      return;
    }
    useProjectsStore.getState().updateProject(copy.id, { name: name.trim() });
    const raw = localStorage.getItem(`${STORAGE_KEYS.canvasStates}:${projectId}`);
    if (raw) localStorage.setItem(`${STORAGE_KEYS.canvasStates}:${copy.id}`, raw);
    setMenuOpen(false);
    toast.addToast({ type: 'success', title: 'Saved as', message: name.trim(), duration: 2500 });
    void router.push(`/project/${copy.id}`);
  }, [projectId, projectName, router, toast]);

  const handleExport = useCallback(() => {
    const raw = projectId ? localStorage.getItem(`${STORAGE_KEYS.canvasStates}:${projectId}`) : null;
    const blob = new Blob([raw || JSON.stringify({ name: projectName, savedAt: Date.now() })], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/[^\w.-]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  }, [projectId, projectName]);

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
        
        <div className={styles.projectMenu} ref={menuRef}>
          <button
            type="button"
            className={styles.projectMenuBtn}
            aria-expanded={menuOpen}
            title={lastSaved ? `Last saved ${formatRelative(lastSaved.toISOString())}` : 'Project'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {isSaving || actionLoading ? <Loader2 size={14} className={styles.spin} /> : <Save size={14} />}
            <span className={styles.projectNameDisplay}>{projectName}</span>
            <ChevronDown size={12} />
          </button>
          {menuOpen && (
            <div className={styles.projectMenuList} role="menu">
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
                <button type="button" role="menuitem" onClick={() => setIsEditingName(true)}>
                  <Pencil size={13} /> Rename
                </button>
              )}
              <button type="button" role="menuitem" disabled={isSaving || actionLoading} onClick={() => { setMenuOpen(false); void handleSave(); }}>
                <Save size={13} /> Save
              </button>
              <button type="button" role="menuitem" onClick={handleSaveAs}>
                <Copy size={13} /> Save as
              </button>
              <button type="button" role="menuitem" onClick={handleExport}>
                <Download size={13} /> Export JSON
              </button>
            </div>
          )}
        </div>

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
