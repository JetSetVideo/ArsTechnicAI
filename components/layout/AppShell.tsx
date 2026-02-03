import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TopBar } from './TopBar';
import { ExplorerPanel } from './ExplorerPanel';
import { InspectorPanel } from './InspectorPanel';
import { Canvas } from './Canvas';
import { Timeline } from './Timeline';
import { SettingsModal } from './SettingsModal';
import { ActionLog } from './ActionLog';
import { useLogStore, useUserStore, useFileStore } from '@/stores';
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

export const AppShell: React.FC = () => {
  const [mode, setMode] = useState<WorkspaceMode>('create');
  const [layout, setLayout] = useState<WorkspaceLayout>(DEFAULT_LAYOUT);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(160);
  const log = useLogStore((s) => s.log);
  
  // User and project management
  const { currentProject, updateProject, refreshDeviceInfo, deviceInfo } = useUserStore();
  const { setCurrentProject } = useFileStore();
  const projectName = currentProject.name;

  // Initialize user info and device capabilities on mount
  useEffect(() => {
    refreshDeviceInfo();
    
    // Log device info for debugging
    console.log('[AppShell] Device info gathered:', deviceInfo);
    
    // Initialize file structure with current project
    setCurrentProject(currentProject.name);
  }, []);

  // Sync project name changes with both stores
  const setProjectName = useCallback((name: string) => {
    updateProject({ name });
    setCurrentProject(name);
    log('settings_change', `Project renamed to: ${name}`, { projectName: name });
  }, [updateProject, setCurrentProject, log]);

  // Refs for resize handling
  const isResizingExplorer = useRef(false);
  const isResizingInspector = useRef(false);
  const isResizingTimeline = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startWidth = useRef(0);
  const startHeight = useRef(0);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Cmd/Ctrl + number to toggle panels
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

  // Global mouse move and mouse up handlers for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingExplorer.current) {
        const delta = e.clientX - startX.current;
        const newWidth = Math.min(
          MAX_PANEL_WIDTH,
          Math.max(MIN_PANEL_WIDTH, startWidth.current + delta)
        );
        setLayout((prev) => ({
          ...prev,
          explorer: { ...prev.explorer, width: newWidth },
        }));
      } else if (isResizingInspector.current) {
        const delta = startX.current - e.clientX;
        const newWidth = Math.min(
          MAX_PANEL_WIDTH,
          Math.max(MIN_PANEL_WIDTH, startWidth.current + delta)
        );
        setLayout((prev) => ({
          ...prev,
          inspector: { ...prev.inspector, width: newWidth },
        }));
      } else if (isResizingTimeline.current) {
        const delta = startY.current - e.clientY;
        const newHeight = Math.min(
          MAX_TIMELINE_HEIGHT,
          Math.max(MIN_TIMELINE_HEIGHT, startHeight.current + delta)
        );
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

  const handleExplorerResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingExplorer.current = true;
      startX.current = e.clientX;
      startWidth.current = layout.explorer.width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [layout.explorer.width]
  );

  const handleInspectorResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingInspector.current = true;
      startX.current = e.clientX;
      startWidth.current = layout.inspector.width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [layout.inspector.width]
  );

  const handleTimelineResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingTimeline.current = true;
      startY.current = e.clientY;
      startHeight.current = timelineHeight;
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [timelineHeight]
  );

  const togglePanel = useCallback((panel: keyof WorkspaceLayout) => {
    setLayout((prev) => ({
      ...prev,
      [panel]: { ...prev[panel], visible: !prev[panel].visible },
    }));
  }, []);

  const handleModeChange = useCallback(
    (newMode: WorkspaceMode) => {
      setMode(newMode);
      log('settings_change', `Switched to ${newMode} mode`, { mode: newMode });

      // Show timeline in timeline mode
      if (newMode === 'timeline') {
        setLayout((prev) => ({
          ...prev,
          timeline: { ...prev.timeline, visible: true },
        }));
      }
    },
    [log]
  );

  return (
    <div className={styles.shell}>
      <TopBar
        currentMode={mode}
        onModeChange={handleModeChange}
        onToggleExplorer={() => togglePanel('explorer')}
        onToggleInspector={() => togglePanel('inspector')}
        onToggleTimeline={() => togglePanel('timeline')}
        onOpenSettings={() => setSettingsOpen(true)}
        explorerVisible={layout.explorer.visible}
        inspectorVisible={layout.inspector.visible}
        timelineVisible={layout.timeline.visible}
        projectName={projectName}
        onProjectNameChange={setProjectName}
      />

      <div className={styles.workspace}>
        {layout.explorer.visible && (
          <>
            <ExplorerPanel width={layout.explorer.width} />
            <div
              className={styles.resizeHandle}
              onMouseDown={handleExplorerResizeStart}
            />
          </>
        )}

        <div className={styles.mainArea}>
          <Canvas showTimeline={layout.timeline.visible} />

          {layout.timeline.visible && (
            <>
              <div
                className={styles.resizeHandleHorizontal}
                onMouseDown={handleTimelineResizeStart}
              />
              <Timeline height={timelineHeight} />
            </>
          )}
        </div>

        {layout.inspector.visible && (
          <>
            <div
              className={styles.resizeHandle}
              onMouseDown={handleInspectorResizeStart}
            />
            <InspectorPanel
              width={layout.inspector.width}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </>
        )}
      </div>

      <ActionLog />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
};
