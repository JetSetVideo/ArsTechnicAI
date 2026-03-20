import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TopBar } from './TopBar';
import { ExplorerPanel } from './ExplorerPanel';
import { InspectorPanel } from './InspectorPanel';
import { Canvas } from './Canvas';
import { NodeGraph } from './NodeGraph';
import { Timeline } from './Timeline';
import { ConnectionOverlay } from './ConnectionOverlay';
import { SettingsModal } from './SettingsModal';
import { ActionLog } from './ActionLog';
import { useLogStore } from '@/stores';
import { useUserStore } from '@/stores/userStore';
import { useFileStore } from '@/stores/fileStore';
import { useProjectSync, saveProjectWorkspaceState, loadProjectWorkspaceState } from '@/hooks/useProjectSync';
import { useSettingsSync } from '@/hooks/useSettingsSync';
import { useDiskReconciliation } from '@/hooks/useDiskReconciliation';
import { saveToDisk } from '@/hooks/useDiskSave';
import { PanelLeft, PanelRight } from 'lucide-react';
import styles from './AppShell.module.css';
import type { WorkspaceMode, WorkspaceLayout } from '@/types';

const DEFAULT_LAYOUT: WorkspaceLayout = {
  explorer: { visible: true, width: 260, collapsed: false },
  inspector: { visible: true, width: 320, collapsed: false },
  timeline: { visible: false, width: 200, collapsed: false },
};

const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH = 500;
const MIN_TIMELINE_HEIGHT = 100;
const MAX_TIMELINE_HEIGHT = 400;

// Modes that use the node graph instead of canvas
const NODE_GRAPH_MODES: WorkspaceMode[] = ['rework'];

export const AppShell: React.FC = () => {
  const [mode, setMode] = useState<WorkspaceMode>('create');
  const [layout, setLayout] = useState<WorkspaceLayout>(DEFAULT_LAYOUT);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(160);
  const log = useLogStore((s) => s.log);
  
  // User and project management
  const { currentProject, updateProject, refreshDeviceInfo, deviceInfo } = useUserStore();
  const { setCurrentProject } = useFileStore();
  const projectName = currentProject.name;

  // Sync editor projects ↔ dashboard projects
  useProjectSync();

  // Reconcile from disk files on fresh start (fills gaps localStorage may have lost)
  useDiskReconciliation();

  // Initialize user info and device capabilities on mount
  useEffect(() => {
    refreshDeviceInfo();
    
    console.log('[AppShell] Device info gathered:', deviceInfo);
    
    setCurrentProject(currentProject.name, currentProject.id);
    void loadProjectWorkspaceState(currentProject.id, currentProject.name);
  }, [currentProject.id, currentProject.name, refreshDeviceInfo, setCurrentProject]);

  // Auto-save to localStorage (fast) + disk (durable) periodically and on unmount
  useEffect(() => {
    const interval = setInterval(() => {
      void saveProjectWorkspaceState(currentProject.id, currentProject.name);
      void saveToDisk();
    }, 15000);

    const handleBeforeUnload = () => {
      saveProjectWorkspaceState(currentProject.id, currentProject.name);
      // Use sendBeacon for reliable save on page unload
      try {
        const { useCanvasStore } = require('@/stores/canvasStore');
        const { useSettingsStore } = require('@/stores/settingsStore');
        const { useProjectsStore } = require('@/stores/projectsStore');
        const { useFileStore } = require('@/stores/fileStore');
        const { items, viewport } = useCanvasStore.getState();
        const settings = useSettingsStore.getState().settings;
        const projects = useProjectsStore.getState().projects;
        const fileState = useFileStore.getState().exportProjectFileState(currentProject.name);
        if (items.length > 0) {
          navigator.sendBeacon('/api/workspace/save', JSON.stringify({
            projectId: currentProject.id,
            projectName: currentProject.name,
            canvas: { viewport, items: items.map((item: any) => ({ ...item, dataUrl: item.src })) },
            fileState: { projectPath: fileState.projectPath, selectedPath: fileState.selectedPath, expandedPaths: fileState.expandedPaths, projectAssets: fileState.projectAssets },
            settings,
            projects: projects.map((p: any) => ({ id: p.id, name: p.name, createdAt: p.createdAt, modifiedAt: p.modifiedAt, assetCount: p.assetCount, tags: p.tags, isFavorite: p.isFavorite, thumbnail: p.thumbnail })),
          }));
        }
      } catch { /* best effort */ }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      void saveProjectWorkspaceState(currentProject.id, currentProject.name);
      void saveToDisk();
    };
  }, [currentProject.id, currentProject.name]);

  // Sync project name changes with both stores
  const setProjectName = useCallback((name: string) => {
    updateProject({ name });
    setCurrentProject(name, currentProject.id);
    log('settings_change', `Project renamed to: ${name}`, { projectName: name });
  }, [updateProject, setCurrentProject, log, currentProject.id]);

  // Sync settings with DB
  useSettingsSync();

  const mainAreaRef = useRef<HTMLDivElement>(null);
  const isResizingExplorer = useRef(false);
  const isResizingInspector = useRef(false);
  const isResizingTimeline = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startWidth = useRef(0);
  const startHeight = useRef(0);

  const showNodeGraph = NODE_GRAPH_MODES.includes(mode);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            togglePanel('explorer');
            break;
          case '2':
            e.preventDefault();
            togglePanel('timeline');
            break;
          case '3':
            e.preventDefault();
            togglePanel('inspector');
            break;
          case ',':
            e.preventDefault();
            setSettingsOpen(true);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Global resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingExplorer.current) {
        const delta = e.clientX - startX.current;
        const newWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startWidth.current + delta));
        setLayout((prev) => ({ ...prev, explorer: { ...prev.explorer, width: newWidth } }));
      } else if (isResizingInspector.current) {
        const delta = startX.current - e.clientX;
        const newWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startWidth.current + delta));
        setLayout((prev) => ({ ...prev, inspector: { ...prev.inspector, width: newWidth } }));
      } else if (isResizingTimeline.current) {
        const delta = startY.current - e.clientY;
        const newHeight = Math.min(MAX_TIMELINE_HEIGHT, Math.max(MIN_TIMELINE_HEIGHT, startHeight.current + delta));
        setTimelineHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      isResizingExplorer.current = false;
      isResizingInspector.current = false;
      isResizingTimeline.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleExplorerResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingExplorer.current = true;
    startX.current = e.clientX;
    startWidth.current = layout.explorer.width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [layout.explorer.width]);

  const handleInspectorResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingInspector.current = true;
    startX.current = e.clientX;
    startWidth.current = layout.inspector.width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [layout.inspector.width]);

  const handleTimelineResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingTimeline.current = true;
    startY.current = e.clientY;
    startHeight.current = timelineHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [timelineHeight]);

  const togglePanel = useCallback((panel: keyof WorkspaceLayout) => {
    setLayout((prev) => ({ ...prev, [panel]: { ...prev[panel], visible: !prev[panel].visible } }));
  }, []);

  const handleModeChange = useCallback((newMode: WorkspaceMode) => {
    if (newMode === 'timeline') {
      // Toggle timeline visibility when clicking the Timeline button
      setLayout((prev) => {
        const next = !prev.timeline.visible;
        return { ...prev, timeline: { ...prev.timeline, visible: next } };
      });
      if (mode !== 'timeline') setMode(newMode);
      log('settings_change', `Toggled timeline`, { mode: newMode });
      return;
    }

    setMode(newMode);
    log('settings_change', `Switched to ${newMode} mode`, { mode: newMode });

    if (newMode === 'rework') {
      setLayout((prev) => ({ ...prev, timeline: { ...prev.timeline, visible: false } }));
    }
  }, [log, mode]);

  return (
    <div id="app-shell-layout-root" className={styles.appShellLayoutRoot}>
      <TopBar
        currentMode={mode}
        onModeChange={handleModeChange}
        onToggleExplorer={() => togglePanel('explorer')}
        onToggleInspector={() => togglePanel('inspector')}
        onToggleTimeline={() => togglePanel('timeline')}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        explorerVisible={layout.explorer.visible}
        inspectorVisible={layout.inspector.visible}
        timelineVisible={layout.timeline.visible}
        projectName={projectName}
        onProjectNameChange={setProjectName}
      />

      <div id="app-shell-workspace-region" className={styles.appShellWorkspaceRegion}>
        {layout.explorer.visible ? (
          <>
            <ExplorerPanel width={layout.explorer.width} onToggle={() => togglePanel('explorer')} />
            <div className={styles.resizeHandle} onMouseDown={handleExplorerResizeStart} />
          </>
        ) : (
          <button
            className={styles.collapsedExplorerToggle}
            onClick={() => togglePanel('explorer')}
            title="Open Explorer (⌘1)"
          >
            <PanelLeft size={18} />
          </button>
        )}

        <div ref={mainAreaRef} className={styles.mainArea}>
          {showNodeGraph ? (
            <NodeGraph />
          ) : (
            <>
              <Canvas showTimeline={layout.timeline.visible} />
              {layout.timeline.visible && (
                <>
                  <div className={styles.resizeHandleHorizontal} onMouseDown={handleTimelineResizeStart} />
                  <Timeline height={timelineHeight} />
                </>
              )}
              {layout.timeline.visible && (
                <ConnectionOverlay containerRef={mainAreaRef} />
              )}
            </>
          )}
        </div>

        {layout.inspector.visible && !showNodeGraph ? (
          <>
            <div className={styles.resizeHandle} onMouseDown={handleInspectorResizeStart} />
            <InspectorPanel
              width={layout.inspector.width}
              onOpenSettings={() => setSettingsOpen(true)}
              onToggle={() => togglePanel('inspector')}
            />
          </>
        ) : (
          !showNodeGraph && (
            <button
              className={styles.collapsedInspectorToggle}
              onClick={() => togglePanel('inspector')}
              title="Open Inspector (⌘3)"
            >
              <PanelRight size={18} />
            </button>
          )
        )}
      </div>

      <ActionLog />

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};
