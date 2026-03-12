import React, { useCallback, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Settings,
  PanelLeft,
  PanelRight,
  PanelBottom,
  ImagePlus,
  Wand2,
  Layers,
  Film,
  Save,
  FolderOpen,
  FolderPlus,
  HelpCircle,
  FileText,
  Clock,
  Loader2,
  X,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { SearchBar } from '../ui/SearchBar';
import { Button } from '../ui/Button';
import { ConnectionStatus } from '../ui/ConnectionStatus';
import { useLogStore, useCanvasStore, useFileStore, useProjectStore } from '@/stores';
import { useProjectSync } from '@/hooks/useProjectSync';
import styles from './TopBar.module.css';
import type { WorkspaceMode, SearchScope } from '@/types';

interface RemoteProject {
  id: string;
  name: string;
  updatedAt: string;
}

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
  const canvasStore = useCanvasStore();
  const fileStore = useFileStore();
  const { projectId, setProject, clearProject } = useProjectStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RemoteProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [openProjectModal, setOpenProjectModal] = useState(false);
  const [allProjects, setAllProjects] = useState<RemoteProject[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const { saveVersion, loadProjectFromDb, isSaving, lastSaved } = useProjectSync(projectId);

  const isAuthenticated = !!session?.user;

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Close open-project modal on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setOpenProjectModal(false);
      }
    };
    if (openProjectModal) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openProjectModal]);

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

  const fetchRecentProjects = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch('/api/projects?pageSize=5');
      if (res.ok) {
        const { data } = await res.json();
        setRecentProjects(data ?? []);
      }
    } catch {
      // Ignore
    }
  }, [isAuthenticated]);

  const handleMenuOpen = () => {
    setMenuOpen((v) => {
      if (!v) fetchRecentProjects();
      return !v;
    });
  };

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
    setMenuOpen(false);

    if (!isAuthenticated) {
      log('project_save', 'Must be signed in to save to the cloud');
      return;
    }

    if (!projectId) {
      // Create project first, then save version
      setActionLoading(true);
      try {
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
          log('project_save', `Created & saved project: ${data.name}`);
        }
      } catch {
        log('project_save', 'Failed to create project');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    // Patch name + create version snapshot
    setActionLoading(true);
    try {
      await Promise.all([
        fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: projectName }),
        }),
        saveVersion('MANUAL', 'Manual save'),
      ]);
      log('project_save', `Saved project: ${projectName}`);
    } catch {
      log('project_save', 'Save failed');
    } finally {
      setActionLoading(false);
    }
  }, [projectId, projectName, isAuthenticated, saveVersion, log, onProjectNameChange]);

  const handleNewProject = useCallback(async () => {
    setMenuOpen(false);
    canvasStore.clearCanvas();
    canvasStore.resetViewport();
    fileStore.loadDemoFiles();
    onProjectNameChange('Untitled Project');
    clearProject();

    if (!isAuthenticated) {
      log('folder_create', 'Created new local project');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Project' }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setProject(data.id, data.name);
        onProjectNameChange(data.name);
        log('folder_create', `Created project: ${data.name}`);
      }
    } catch {
      log('folder_create', 'Failed to create project in DB');
    } finally {
      setActionLoading(false);
    }
  }, [canvasStore, fileStore, onProjectNameChange, isAuthenticated, log]);

  const handleOpenProjectClick = useCallback(async () => {
    setMenuOpen(false);

    if (!isAuthenticated) {
      log('folder_open', 'Must be signed in to open cloud projects');
      return;
    }

    setLoadingProjects(true);
    setOpenProjectModal(true);
    try {
      const res = await fetch('/api/projects?pageSize=20');
      if (res.ok) {
        const { data } = await res.json();
        setAllProjects(data ?? []);
      }
    } catch {
      setAllProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [isAuthenticated, log]);

  const handleSelectProject = useCallback(
    async (project: RemoteProject) => {
      setOpenProjectModal(false);
      canvasStore.clearCanvas();
      canvasStore.resetViewport();
      onProjectNameChange(project.name);
      await loadProjectFromDb(project.id);
      log('folder_open', `Opened project: ${project.name}`);
    },
    [canvasStore, loadProjectFromDb, onProjectNameChange, log]
  );

  const handleOpenRecentProject = useCallback(
    async (project: RemoteProject) => {
      setMenuOpen(false);
      canvasStore.clearCanvas();
      canvasStore.resetViewport();
      onProjectNameChange(project.name);
      await loadProjectFromDb(project.id);
      log('folder_open', `Opened recent project: ${project.name}`);
    },
    [canvasStore, loadProjectFromDb, onProjectNameChange, log]
  );

  return (
    <header className={styles.topBar}>
      {/* Left section - Project Menu & Logo */}
      <div className={styles.section}>
        <div className={styles.projectSelector} ref={menuRef}>
          <button
            className={`${styles.projectButton} ${menuOpen ? styles.open : ''}`}
            onClick={handleMenuOpen}
            title="Project Menu"
          >
            <div className={styles.logo}>
              <span className={styles.logoArs}>Ars</span>
              <span className={styles.logoTechnic}>Technic</span>
              <span className={styles.logoAI}>AI</span>
            </div>
            <span className={styles.projectName}>{projectName}</span>
            <ChevronDown size={14} className={styles.chevron} />
          </button>

          {menuOpen && (
            <div className={styles.projectMenu}>
              <div className={styles.menuSection}>
                <button className={styles.menuItem} onClick={handleNewProject}>
                  <FolderPlus size={14} />
                  <span>New Project</span>
                  <kbd>⌘N</kbd>
                </button>
                <button className={styles.menuItem} onClick={handleOpenProjectClick}>
                  <FolderOpen size={14} />
                  <span>Open Project…</span>
                  <kbd>⌘O</kbd>
                </button>
                <button className={styles.menuItem} onClick={handleSave} disabled={actionLoading}>
                  <Save size={14} />
                  <span>
                    {isSaving || actionLoading ? 'Saving…' : 'Save Project'}
                  </span>
                  <kbd>⌘S</kbd>
                </button>
              </div>

              <div className={styles.menuDivider} />

              <div className={styles.menuSection}>
                <div className={styles.menuLabel}>
                  Recent Projects
                  {!isAuthenticated && (
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (sign in)</span>
                  )}
                </div>
                {recentProjects.length === 0 && (
                  <div className={styles.menuItem} style={{ opacity: 0.5, cursor: 'default' }}>
                    <FileText size={14} />
                    <span>No recent projects</span>
                  </div>
                )}
                {recentProjects.map((project) => (
                  <button
                    key={project.id}
                    className={styles.menuItem}
                    onClick={() => handleOpenRecentProject(project)}
                  >
                    <FileText size={14} />
                    <span className={styles.menuItemContent}>
                      <span className={styles.projectTitle}>{project.name}</span>
                      <span className={styles.projectMeta}>
                        <Clock size={10} />
                        {formatRelative(project.updatedAt)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <div className={styles.menuDivider} />

              <div className={styles.menuSection}>
                <button className={styles.menuItem} onClick={onOpenSettings}>
                  <Settings size={14} />
                  <span>Settings</span>
                  <kbd>⌘,</kbd>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.divider} />

        {/* Mode switcher */}
        <nav className={styles.modeNav}>
          {modes.map((mode) => (
            <button
              key={mode.id}
              className={`${styles.modeButton} ${currentMode === mode.id ? styles.active : ''}`}
              onClick={() => onModeChange(mode.id)}
              title={mode.label}
            >
              {mode.icon}
              <span>{mode.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Center section - Search */}
      <div className={styles.section}>
        <SearchBar onSearch={handleSearch} placeholder="Search files or Google images..." />
      </div>

      {/* Right section */}
      <div className={styles.section}>
        <div className={styles.panelToggles}>
          <button
            className={`${styles.toggleButton} ${explorerVisible ? styles.active : ''}`}
            onClick={onToggleExplorer}
            title="Toggle Explorer (⌘1)"
          >
            <PanelLeft size={18} />
          </button>
          <button
            className={`${styles.toggleButton} ${timelineVisible ? styles.active : ''}`}
            onClick={onToggleTimeline}
            title="Toggle Timeline (⌘2)"
          >
            <PanelBottom size={18} />
          </button>
          <button
            className={`${styles.toggleButton} ${inspectorVisible ? styles.active : ''}`}
            onClick={onToggleInspector}
            title="Toggle Inspector (⌘3)"
          >
            <PanelRight size={18} />
          </button>
        </div>
      </div>

      {/* Bottom row: Project menu + mode nav | Settings + Help */}
      <div className={styles.row}>
        <div className={styles.section}>
          <div className={styles.projectSelector} ref={menuRef}>
            <button
              className={`${styles.projectButton} ${menuOpen ? styles.open : ''}`}
              onClick={() => setMenuOpen(!menuOpen)}
              title="Project Menu"
            >
              <span className={styles.projectName}>{projectName}</span>
              <ChevronDown size={14} className={styles.chevron} />
            </button>

        <div className={styles.actions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            title={lastSaved ? `Last saved ${formatRelative(lastSaved.toISOString())}` : 'Save'}
          >
            {isSaving || actionLoading ? <Loader2 size={16} className={styles.spin} /> : <Save size={16} />}
          </Button>
          <Button variant="ghost" size="sm" onClick={onOpenSettings} title="Settings">
            <Settings size={16} />
          </Button>
          <Button variant="ghost" size="sm" title="Help">
            <HelpCircle size={16} />
          </Button>
          <ConnectionStatus />
        </div>
      </div>

      {/* Open Project modal */}
      {openProjectModal && (
        <div className={styles.projectModalOverlay}>
          <div className={styles.projectModal} ref={modalRef}>
            <div className={styles.projectModalHeader}>
              <span>Open Project</span>
              <button onClick={() => setOpenProjectModal(false)}>
                <X size={14} />
              </button>
            </div>
            {loadingProjects ? (
              <div className={styles.projectModalLoading}>
                <Loader2 size={16} className={styles.spin} /> Loading projects…
              </div>
            ) : allProjects.length === 0 ? (
              <div className={styles.projectModalEmpty}>No projects found.</div>
            ) : (
              <div className={styles.projectModalList}>
                {allProjects.map((project) => (
                  <button
                    key={project.id}
                    className={styles.projectModalItem}
                    onClick={() => handleSelectProject(project)}
                  >
                    <FileText size={14} />
                    <span className={styles.menuItemContent}>
                      <span className={styles.projectTitle}>{project.name}</span>
                      <span className={styles.projectMeta}>
                        <Clock size={10} />
                        {formatRelative(project.updatedAt)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
