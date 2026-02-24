/**
 * DashboardLayout
 *
 * Main dashboard wrapper with project grid, search, and settings/help.
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Settings, Search, HelpCircle } from 'lucide-react';
import { useRouter } from 'next/router';
import styles from './DashboardLayout.module.css';
import { Button } from '../ui';
import { ConnectionBanner } from '../ui/ConnectionBanner';
import { SettingsModal } from './SettingsModal';
import { HelpModal } from './HelpModal';
import { useProjectSync, saveProjectWorkspaceState } from '../../hooks/useProjectSync';
import { useUserStore } from '../../stores/userStore';
import { ProjectsGrid } from '../dashboard/ProjectsGrid';

export function DashboardLayout() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const { openProjectFromDashboard } = useProjectSync();
  const currentProject = useUserStore((s) => s.currentProject);

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

      <main id="dashboard-layout-main-content-region" className={styles.dashboardLayoutMainContentRegion}>
        <div className={styles.dashboardLayoutMainProjectsContentRegion}>
          <ProjectsGrid onOpenProject={handleOpenProject} searchQuery={searchQuery} />
        </div>
      </main>
    </div>
  );
}

export default DashboardLayout;
