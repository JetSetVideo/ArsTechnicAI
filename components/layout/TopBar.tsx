import React, { useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Settings,
  ImagePlus,
  Wand2,
  Layers,
  Film,
  Save,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { SearchBar } from '../ui/SearchBar';
import { useLogStore, useCanvasStore, useProjectStore, useNodeStore } from '@/stores';
import { useProjectSync, saveProjectWorkspaceState } from '@/hooks/useProjectSync';
import { saveToDisk } from '@/hooks/useDiskSave';
import styles from './TopBar.module.css';
import type { WorkspaceMode, SearchScope } from '@/types';

interface TopBarProps {
  currentMode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
  onToggleExplorer: () => void;
  onToggleInspector: () => void;
  onToggleTimeline: () => void;
  onOpenSettings: () => void;
  onOpenHelp?: () => void;
  explorerVisible: boolean;
  inspectorVisible: boolean;
  timelineVisible: boolean;
  projectName: string;
  onProjectNameChange: (name: string) => void;
}

const modes: { id: WorkspaceMode; label: string; icon: React.ReactNode }[] = [
  { id: 'create', label: 'Create', icon: <ImagePlus size={16} /> },
  { id: 'rework', label: 'Rework', icon: <Wand2 size={16} /> },
  { id: 'composite', label: 'Composite', icon: <Layers size={16} /> },
  { id: 'timeline', label: 'Timeline', icon: <Film size={16} /> },
];

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
  currentMode,
  onModeChange,
  onToggleExplorer,
  onToggleInspector,
  onToggleTimeline,
  onOpenSettings,
  onOpenHelp,
  explorerVisible,
  inspectorVisible,
  timelineVisible,
  projectName,
  onProjectNameChange,
}) => {
  const { data: session } = useSession();
  const log = useLogStore((s) => s.log);
  const { projectId, setProject } = useProjectStore();
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
  }, [projectId, projectName, isAuthenticated, saveVersion, log, onProjectNameChange, setProject]);

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

  const handleModeClick = (modeId: WorkspaceMode) => {
    onModeChange(modeId);
    
    if (modeId === 'create') {
      const { addNode } = useNodeStore.getState();
      const { viewport } = useCanvasStore.getState();
      
      // Calculate center of viewport
      // We use window dimensions as a proxy for canvas size since we don't have ref here
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      
      const x = (cx - viewport.x) / viewport.zoom - 130; // Center horizontally (node width ~260)
      const y = (cy - viewport.y) / viewport.zoom - 100; // Center vertically
      
      addNode('prompt', x, y);
      log('canvas_add', 'Added prompt node via Create button');
    }
  };

  return (
    <header className={styles.topBar}>
      {/* Left section - Logo, Breadcrumbs, Save, Search */}
      <div className={styles.section}>
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

      {/* Right section - Mode Nav, Inspector Toggle, Settings */}
      <div className={styles.section}>
        {/* Mode switcher */}
        <nav className={styles.modeNav}>
          {modes.map((mode) => (
            <button
              key={mode.id}
              className={`${styles.modeButton} ${currentMode === mode.id ? styles.active : ''}`}
              onClick={() => handleModeClick(mode.id)}
              title={mode.label}
            >
              {mode.icon}
              <span>{mode.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};
