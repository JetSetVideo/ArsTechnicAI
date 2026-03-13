/**
 * DashboardLayout
 *
 * Main dashboard wrapper with project grid, search, and settings/help.
 */

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Search, UserRound } from 'lucide-react';
import { useRouter } from 'next/router';
import styles from './DashboardLayout.module.css';
import { Button } from '../ui';
import { ConnectionBanner } from '../ui/ConnectionBanner';
import { SettingsModal } from './SettingsModal';
import { NavigationBar } from './NavigationBar';
import { useProjectSync, saveProjectWorkspaceState } from '../../hooks/useProjectSync';
import { useUserStore } from '../../stores/userStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { ProjectsGrid } from '../dashboard/ProjectsGrid';

export function DashboardLayout() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'account' | 'api' | 'appearance' | 'shortcuts' | 'help' | 'about'>('account');

  const { openProjectFromDashboard } = useProjectSync();
  const currentProject = useUserStore((s) => s.currentProject);
  const health = useTelemetryStore((s) => s.health);

  const handleOpenProject = useCallback(
    (projectId: string) => {
      void saveProjectWorkspaceState(currentProject.id, currentProject.name);
      openProjectFromDashboard(projectId);
      router.push(`/?project=${projectId}`);
    },
    [router, currentProject.id, currentProject.name, openProjectFromDashboard]
  );

  const profilePictureClass = health?.status === 'ok' 
    ? styles.dashboardLayoutProfilePictureConnected 
    : health?.status === 'error' || health?.status === 'degraded'
      ? styles.dashboardLayoutProfilePictureDisconnected 
      : '';

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
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setSettingsTab('account');
                setSettingsOpen(true);
              }} 
              title="Account and Preferences"
              style={{ padding: '4px' }}
            >
              <div className={`${styles.dashboardLayoutProfilePicture} ${profilePictureClass}`}>
                <UserRound size={14} />
              </div>
            </Button>
          </div>
        </div>
      </header>

      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        defaultTab={settingsTab} 
      />

      {/* Secondary Navigation */}
      <NavigationBar variant="compact" />

      <main id="dashboard-layout-main-content-region" className={styles.dashboardLayoutMainContentRegion}>
        <div className={styles.dashboardLayoutMainProjectsContentRegion}>
          <ProjectsGrid onOpenProject={handleOpenProject} searchQuery={searchQuery} />
        </div>
      </main>
    </div>
  );
}

export default DashboardLayout;
