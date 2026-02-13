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
} from 'lucide-react';
import { SearchBar } from '../ui/SearchBar';
import { Button } from '../ui/Button';
import { useLogStore, useCanvasStore, useFileStore, useUserStore } from '@/stores';
import { useProjectsStore } from '@/stores/projectsStore';
import { saveCanvasState, loadCanvasState } from '@/hooks/useProjectSync';
import { formatRelativeTime } from '@/utils/date';
import styles from './TopBar.module.css';
import type { WorkspaceMode, SearchScope } from '@/types';

interface ProjectData {
  name: string;
  version: string;
  createdAt: number;
  modifiedAt: number;
  canvas: {
    items: ReturnType<typeof useCanvasStore.getState>['items'];
    viewport: ReturnType<typeof useCanvasStore.getState>['viewport'];
  };
  files: {
    rootNodes: ReturnType<typeof useFileStore.getState>['rootNodes'];
  };
}

interface TopBarProps {
  currentMode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
  onToggleExplorer: () => void;
  onToggleInspector: () => void;
  onToggleTimeline: () => void;
  onOpenSettings: () => void;
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

export const TopBar: React.FC<TopBarProps> = ({
  currentMode,
  onModeChange,
  onToggleExplorer,
  onToggleInspector,
  onToggleTimeline,
  onOpenSettings,
  explorerVisible,
  inspectorVisible,
  timelineVisible,
  projectName,
  onProjectNameChange,
}) => {
  const log = useLogStore((s) => s.log);
  const canvasStore = useCanvasStore();
  const fileStore = useFileStore();
  const currentProject = useUserStore((s) => s.currentProject);
  const recentUserProjects = useUserStore((s) => s.recentProjects);
  const switchProjectUser = useUserStore((s) => s.switchProject);
  const recentDashboardProjects = useProjectsStore((s) => s.getRecentProjects(5));
  
  // Merge recent projects from both stores, dedup by id
  const recentProjects = (() => {
    const seen = new Set<string>();
    const merged: { id: string; name: string; lastModified: string }[] = [];
    
    // Dashboard recent first (more authoritative)
    for (const p of recentDashboardProjects) {
      if (seen.has(p.id) || p.id === currentProject?.id) continue;
      seen.add(p.id);
      merged.push({ id: p.id, name: p.name, lastModified: formatRelativeTime(p.modifiedAt) });
    }
    // Then userStore recent
    for (const p of recentUserProjects) {
      if (seen.has(p.id) || p.id === currentProject?.id) continue;
      seen.add(p.id);
      merged.push({ id: p.id, name: p.name, lastModified: formatRelativeTime(p.modifiedAt) });
    }
    return merged.slice(0, 5);
  })();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleSearch = useCallback(
    (query: string, scope: SearchScope) => {
      log('search', `Searched for "${query}" in ${scope}`, { query, scope });

      if (scope === 'google' || scope === 'all') {
        // Open Google search in new tab
        window.open(
          `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`,
          '_blank'
        );
      }

      // File search would be handled internally
      console.log('Search:', query, scope);
    },
    [log]
  );

  const handleSave = useCallback(() => {
    // Also save canvas state to localStorage for per-project persistence
    if (currentProject?.id) {
      saveCanvasState(currentProject.id);
    }

    // Update modified timestamp in projectsStore
    if (currentProject?.id) {
      useProjectsStore.getState().updateProject(currentProject.id, {
        assetCount: canvasStore.items.length,
      });
    }

    // Create project data object for file export
    const projectData: ProjectData = {
      name: projectName,
      version: '1.0.0',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      canvas: {
        items: canvasStore.items,
        viewport: canvasStore.viewport,
      },
      files: {
        rootNodes: fileStore.rootNodes,
      },
    };

    // Convert to JSON and create blob
    const jsonString = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create download link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.arstechnic`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setMenuOpen(false);
    log('file_export', `Project saved: ${projectName}`);
  }, [currentProject?.id, projectName, canvasStore.items, canvasStore.viewport, fileStore.rootNodes, log]);

  const handleNewProject = useCallback(() => {
    // Save current canvas state before creating new project
    if (currentProject?.id) {
      saveCanvasState(currentProject.id);
    }

    // Clear canvas
    canvasStore.clearCanvas();
    canvasStore.resetViewport();

    // Create a new project in userStore (which generates a new ID)
    const newProj = useUserStore.getState().createNewProject();

    // Register in projectsStore
    useProjectsStore.setState((state) => ({
      projects: [
        {
          id: newProj.id,
          name: newProj.name,
          createdAt: newProj.createdAt,
          modifiedAt: newProj.modifiedAt,
          assetCount: 0,
          tags: [],
          isFavorite: false,
        },
        ...state.projects.filter((p) => p.id !== newProj.id),
      ],
    }));
    
    // Reset file store with new project structure
    fileStore.initializeFileStructure(newProj.name);
    
    onProjectNameChange(newProj.name);
    setMenuOpen(false);
    log('folder_create', `Created new project: ${newProj.name}`);
  }, [currentProject?.id, canvasStore, fileStore, onProjectNameChange, log]);

  const handleOpenProjectClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const projectData: ProjectData = JSON.parse(text);

        // Validate project data
        if (!projectData.name || !projectData.canvas) {
          throw new Error('Invalid project file format');
        }

        // Load canvas items
        canvasStore.clearCanvas();
        projectData.canvas.items.forEach((item) => {
          canvasStore.addItem(item);
        });
        if (projectData.canvas.viewport) {
          canvasStore.setViewport(projectData.canvas.viewport);
        }

        // Load file tree if present
        if (projectData.files?.rootNodes) {
          fileStore.setRootNodes(projectData.files.rootNodes);
        }

        // Update project name
        onProjectNameChange(projectData.name);
        setMenuOpen(false);
        log('folder_open', `Opened project: ${projectData.name}`);
      } catch (error) {
        console.error('Failed to open project:', error);
        alert('Failed to open project. The file may be corrupted or invalid.');
      }

      // Reset input
      e.target.value = '';
    },
    [canvasStore, fileStore, onProjectNameChange, log]
  );

  const handleOpenRecentProject = useCallback((projectId: string, name: string) => {
    // Save current project's canvas state first
    if (currentProject?.id) {
      saveCanvasState(currentProject.id);
    }

    // Switch project in userStore
    switchProjectUser(projectId);

    // Load saved canvas state for the opened project
    loadCanvasState(projectId);

    // Update file structure
    fileStore.setCurrentProject(name);

    // Mark opened in projectsStore
    useProjectsStore.getState().openProject(projectId);

    onProjectNameChange(name);
    setMenuOpen(false);
    log('folder_open', `Opened project: ${name}`);
  }, [currentProject?.id, switchProjectUser, fileStore, onProjectNameChange, log]);

  return (
    <header className={styles.topBar}>
      {/* Top row: App name | Search | Panel toggles tag */}
      <div className={styles.row}>
        <Link href="/home" className={styles.appName} title="Go to Dashboard">
          <span className={styles.logoArs}>Ars</span>
          <span className={styles.logoTechnic}>Technic</span>
          <span className={styles.logoAI}>AI</span>
        </Link>

        <div className={styles.searchWrap}>
          <SearchBar onSearch={handleSearch} placeholder="Search files or Google images..." />
        </div>

        <div className={styles.panelTag}>
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
                    <span>Open Project...</span>
                    <kbd>⌘O</kbd>
                  </button>
                  <button className={styles.menuItem} onClick={handleSave}>
                    <Save size={14} />
                    <span>Save Project</span>
                    <kbd>⌘S</kbd>
                  </button>
                </div>

                <div className={styles.menuDivider} />

                <div className={styles.menuSection}>
                  <div className={styles.menuLabel}>Recent Projects</div>
                  {recentProjects.length > 0 ? (
                    recentProjects.map((project) => (
                      <button
                        key={project.id}
                        className={styles.menuItem}
                        onClick={() => handleOpenRecentProject(project.id, project.name)}
                      >
                        <FileText size={14} />
                        <span className={styles.menuItemContent}>
                          <span className={styles.projectTitle}>{project.name}</span>
                          <span className={styles.projectMeta}>
                            <Clock size={10} />
                            {project.lastModified}
                          </span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className={styles.menuLabel} style={{ opacity: 0.5 }}>
                      No recent projects
                    </div>
                  )}
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

          <nav className={styles.modeNav}>
            {modes.map((mode) => (
              <button
                key={mode.id}
                className={`${styles.modeButton} ${
                  currentMode === mode.id ? styles.active : ''
                }`}
                onClick={() => onModeChange(mode.id)}
                title={mode.label}
              >
                {mode.icon}
                <span>{mode.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className={styles.section}>
          <div className={styles.actions}>
            <Button variant="ghost" size="sm" onClick={onOpenSettings} title="Settings">
              <Settings size={16} />
            </Button>
            <Button variant="ghost" size="sm" title="Help">
              <HelpCircle size={16} />
            </Button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".arstechnic,.json"
        className={styles.hiddenInput}
        onChange={handleFileSelect}
      />
    </header>
  );
};
