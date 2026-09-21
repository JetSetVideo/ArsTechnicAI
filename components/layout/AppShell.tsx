import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TopBar } from './TopBar';
import { ExplorerPanel } from './ExplorerPanel';
import { WorkshopFlow } from '../workshop/WorkshopFlow';
import { SettingsModal } from './SettingsModal';
import { ActionLog } from './ActionLog';
import { PanelErrorBoundary } from '../ui/PanelErrorBoundary';
import { useLogStore } from '@/stores';
import { useToastStore } from '@/stores/toastStore';
import { useUserStore } from '@/stores/userStore';
import { useFileStore } from '@/stores/fileStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useProjectSync, saveProjectWorkspaceState, loadProjectWorkspaceState } from '@/hooks/useProjectSync';
import { useSettingsSync } from '@/hooks/useSettingsSync';
import { useDiskReconciliation } from '@/hooks/useDiskReconciliation';
import { saveToDisk } from '@/hooks/useDiskSave';
import { PanelLeft, Music, Share2 } from 'lucide-react';
import styles from './AppShell.module.css';
import type { WorkspaceLayout } from '@/types';

const DEFAULT_LAYOUT: WorkspaceLayout = {
  explorer: { visible: true, width: 260, collapsed: false },
  inspector: { visible: true, width: 320, collapsed: false },
  timeline: { visible: false, width: 200, collapsed: false },
};

const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH = 500;

// The project page is always the Workshop pipeline editor now — Canvas (the
// old freeform per-item editor) and the `?workshop=1` mode-switch it required
// are retired; every project opens the same UI regardless of how it's
// reached (project card, green banner, or a direct link), which is the
// entire point of the Canvas/Workshop merge.

export const AppShell: React.FC = () => {
  const [layout, setLayout] = useState<WorkspaceLayout>(DEFAULT_LAYOUT);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>(undefined);

  // First-run onboarding (Design.md §22)
  const [onboardingStep, setOnboardingStep] = useState<0 | 1 | 2 | 3>(0); // 0=hidden
  const pipelineNodeCount = usePipelineStore((s) => s.nodes.length);
  const fileNodes = useFileStore((s) => s.rootNodes ?? []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const done = localStorage.getItem('ars:onboarding-complete');
    if (done) return;
    if (pipelineNodeCount === 0 && fileNodes.length === 0) {
      setOnboardingStep(1);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissOnboarding = () => {
    localStorage.setItem('ars:onboarding-complete', 'true');
    setOnboardingStep(0);
  };

  const log = useLogStore((s) => s.log);
  const toast = useToastStore();

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

  // Auto-save periodically and on unmount. The pipeline store already
  // debounces + dirty-checks its own persistence (see the
  // `usePipelineStore.subscribe` at the bottom of stores/pipelineStore.ts) —
  // this interval's job is just the disk safety net for the file-explorer
  // tree, plus a final flush of both on unmount/unload.
  useEffect(() => {
    const interval = setInterval(() => {
      void saveToDisk();
    }, 15000);

    const handleBeforeUnload = () => {
      usePipelineStore.getState().saveForProject(currentProject.id, currentProject.name);
      try {
        useFileStore.getState().saveProjectFileState(currentProject.id, currentProject.name);
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

  const isResizingExplorer = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        togglePanel('explorer');
      } else if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Explorer resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingExplorer.current) return;
      const delta = e.clientX - startX.current;
      const newWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startWidth.current + delta));
      setLayout((prev) => ({ ...prev, explorer: { ...prev.explorer, width: newWidth } }));
    };

    const handleMouseUp = () => {
      isResizingExplorer.current = false;
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

  const togglePanel = useCallback((panel: keyof WorkspaceLayout) => {
    setLayout((prev) => ({ ...prev, [panel]: { ...prev[panel], visible: !prev[panel].visible } }));
  }, []);

  return (
    <div id="app-shell-layout-root" className={styles.appShellLayoutRoot}>
      <TopBar
        onOpenSettings={() => setSettingsOpen(true)}
        projectName={projectName}
        onProjectNameChange={setProjectName}
        moduleActions={(
          <div className={styles.moduleBar}>
            <button title="Audio — coming soon" onClick={() => toast.addToast({ type: 'info', title: 'Audio Module', message: 'Audio generation and mixing is coming soon.', duration: 4000 })}>
              <Music size={15} />
            </button>
            <div className={styles.moduleBarDivider} />
            <button title="Publish" onClick={() => { setSettingsInitialTab('publishing'); setSettingsOpen(true); }}>
              <Share2 size={15} />
            </button>
          </div>
        )}
      />

      <div id="app-shell-workspace-region" className={styles.appShellWorkspaceRegion}>
        {layout.explorer.visible ? (
          <>
            <PanelErrorBoundary panelName="Explorer">
              <ExplorerPanel width={layout.explorer.width} onToggle={() => togglePanel('explorer')} />
            </PanelErrorBoundary>
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

        <div className={styles.mainArea}>
          <PanelErrorBoundary panelName="Workshop">
            <WorkshopFlow />
          </PanelErrorBoundary>
        </div>
      </div>

      <ActionLog />

      <SettingsModal isOpen={settingsOpen} onClose={() => { setSettingsOpen(false); setSettingsInitialTab(undefined); }} defaultTab={settingsInitialTab as 'publishing' | undefined} />

      {/* First-run onboarding overlay — Design.md §22 */}
      {onboardingStep > 0 && (
        <div className={styles.onboardingOverlay}>
          <div className={styles.onboardingCard}>
            <div className={styles.onboardingHeader}>
              <span className={styles.onboardingBrand}>Ars TechnicAI</span>
              <button className={styles.onboardingSkip} onClick={dismissOnboarding}>Skip tour</button>
            </div>

            <div className={styles.onboardingSteps}>
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className={`${styles.onboardingDot} ${onboardingStep === n ? styles.onboardingDotActive : onboardingStep > n ? styles.onboardingDotDone : ''}`}
                />
              ))}
            </div>

            {onboardingStep === 1 && (
              <div className={styles.onboardingBody}>
                <div className={styles.onboardingIcon}>📥</div>
                <h2 className={styles.onboardingTitle}>Import or Generate</h2>
                <p className={styles.onboardingText}>Drag any image, video, or audio file into the Explorer on the left — or click <b>+ Add node</b> at the top to bring in a moodboard, script, character, or generated visual.</p>
              </div>
            )}
            {onboardingStep === 2 && (
              <div className={styles.onboardingBody}>
                <div className={styles.onboardingIcon}>🎨</div>
                <h2 className={styles.onboardingTitle}>Build the pipeline</h2>
                <p className={styles.onboardingText}>Every node can generate, import, or be tuned by hand, and stacks alternatives vertically. Drag a node anywhere on the canvas — it stays right where you drop it. Connect ports to wire nodes together.</p>
              </div>
            )}
            {onboardingStep === 3 && (
              <div className={styles.onboardingBody}>
                <div className={styles.onboardingIcon}>🚀</div>
                <h2 className={styles.onboardingTitle}>Cut and deliver</h2>
                <p className={styles.onboardingText}>Add pictures to the Film order strip at the bottom to build your cut, then use Format Profiles to export in 9:16, 1:1, or 16:9 for any platform.</p>
              </div>
            )}

            <div className={styles.onboardingFooter}>
              <span className={styles.onboardingProgress}>Step {onboardingStep} of 3</span>
              <div className={styles.onboardingActions}>
                {onboardingStep > 1 && (
                  <button className={styles.onboardingBack} onClick={() => setOnboardingStep((s) => (s - 1) as 0 | 1 | 2 | 3)}>← Back</button>
                )}
                {onboardingStep < 3 ? (
                  <button className={styles.onboardingNext} onClick={() => setOnboardingStep((s) => (s + 1) as 0 | 1 | 2 | 3)}>Next →</button>
                ) : (
                  <button className={styles.onboardingNext} onClick={dismissOnboarding}>Get started →</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
