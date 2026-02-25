/**
 * DashboardLayout
 *
 * Main dashboard wrapper with project grid, search, and settings/help.
 */

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Settings, Search, HelpCircle, UserRound, Wifi } from 'lucide-react';
import { useRouter } from 'next/router';
import styles from './DashboardLayout.module.css';
import { Button } from '../ui';
import { ConnectionBanner } from '../ui/ConnectionBanner';
import { SettingsModal } from './SettingsModal';
import { HelpModal } from './HelpModal';
import { useProjectSync, saveProjectWorkspaceState } from '../../hooks/useProjectSync';
import { useUserStore } from '../../stores/userStore';
import { ProjectsGrid } from '../dashboard/ProjectsGrid';
import type { HealthResponse } from '@/pages/api/health';

export function DashboardLayout() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountHealth, setAccountHealth] = useState<HealthResponse | null>(null);
  const [accountHealthError, setAccountHealthError] = useState<string>('');

  const { openProjectFromDashboard } = useProjectSync();
  const currentProject = useUserStore((s) => s.currentProject);
  const session = useUserStore((s) => s.session);

  useEffect(() => {
    if (!accountOpen) return;
    let mounted = true;

    const loadConnectionStatus = async () => {
      setAccountHealthError('');
      try {
        const response = await fetch('/api/health');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = (await response.json()) as HealthResponse;
        if (mounted) setAccountHealth(json);
      } catch (error) {
        if (!mounted) return;
        setAccountHealthError(error instanceof Error ? error.message : 'Cannot reach health endpoint');
      }
    };

    void loadConnectionStatus();
    return () => {
      mounted = false;
    };
  }, [accountOpen]);

  const handleOpenProject = useCallback(
    (projectId: string) => {
      void saveProjectWorkspaceState(currentProject.id, currentProject.name);
      openProjectFromDashboard(projectId);
      router.push(`/?project=${projectId}`);
    },
    [router, currentProject.id, currentProject.name, openProjectFromDashboard]
  );

  return (
    <div id="dashboard-layout-root-page-region" className={styles.dashboardLayoutRootPageRegion}>
      <ConnectionBanner />
      <header id="dashboard-layout-header-primary-top" className={styles.dashboardLayoutHeaderPrimaryAtTop}>
        <div className={styles.dashboardLayoutHeaderPrimaryContentRow}>
          <Link href="/home" className={styles.dashboardLayoutHeaderBrandLinkHome} title="Dashboard Home">
            <span className={styles.dashboardLayoutHeaderBrandLogoArs}>Ars</span>
            <span className={styles.dashboardLayoutHeaderBrandLogoTechnic}>Technic</span>
            <span className={styles.dashboardLayoutHeaderBrandLogoAi}>AI</span>
          </Link>

          <div className={styles.dashboardLayoutHeaderSearchContainer}>
            <Search size={18} className={styles.dashboardLayoutHeaderSearchIcon} />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.dashboardLayoutHeaderSearchInputField}
            />
          </div>

          <div className={styles.dashboardLayoutHeaderPrimaryActionsRight}>
            <Button variant="ghost" size="sm" onClick={() => setAccountOpen(true)} title="Account and Connection">
              <UserRound size={18} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} title="Settings">
              <Settings size={18} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setHelpOpen(true)} title="Help">
              <HelpCircle size={18} />
            </Button>
          </div>
        </div>
      </header>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      {accountOpen && (
        <div className={styles.dashboardLayoutAccountModalOverlay} onClick={() => setAccountOpen(false)}>
          <div className={styles.dashboardLayoutAccountModalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.dashboardLayoutAccountModalHeader}>
              <h3>Account & Connection</h3>
              <button
                type="button"
                className={styles.dashboardLayoutAccountModalCloseButton}
                onClick={() => setAccountOpen(false)}
              >
                Close
              </button>
            </div>
            <div className={styles.dashboardLayoutAccountModalBody}>
              <p><strong>Session:</strong> {session.sessionId.slice(0, 8)}...</p>
              <p><strong>Current project:</strong> {currentProject.name}</p>
              <p><strong>Auth token:</strong> {typeof window !== 'undefined' && localStorage.getItem('token') ? 'Available' : 'Not signed in'}</p>
              <div className={styles.dashboardLayoutAccountConnectionStatus}>
                <Wifi size={14} />
                {accountHealthError
                  ? `Connection check failed: ${accountHealthError}`
                  : accountHealth
                    ? `Status: ${accountHealth.status}`
                    : 'Checking connection...'}
              </div>
              {accountHealth?.services?.map((service) => (
                <p key={service.name} className={styles.dashboardLayoutAccountServiceRow}>
                  <strong>{service.name}:</strong> {service.message || service.status}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      <main id="dashboard-layout-main-content-region" className={styles.dashboardLayoutMainContentRegion}>
        <div className={styles.dashboardLayoutMainProjectsContentRegion}>
          <ProjectsGrid onOpenProject={handleOpenProject} searchQuery={searchQuery} />
        </div>
      </main>
    </div>
  );
}

export default DashboardLayout;
