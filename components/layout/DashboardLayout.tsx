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
import { useProjectSync, saveCanvasState } from '../../hooks/useProjectSync';
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
      saveCanvasState(currentProject.id);
      openProjectFromDashboard(projectId);
      router.push(`/?project=${projectId}`);
    },
    [router, currentProject.id, openProjectFromDashboard]
  );

  return (
    <div className={styles.dashboard}>
      <ConnectionBanner />
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <Link href="/home" className={styles.appName} title="Dashboard Home">
            <span className={styles.logoArs}>Ars</span>
            <span className={styles.logoTechnic}>Technic</span>
            <span className={styles.logoAI}>AI</span>
          </Link>

          <div className={styles.searchBar}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.headerActions}>
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

      <main className={styles.main}>
        <div className={styles.tabContent}>
          <ProjectsGrid onOpenProject={handleOpenProject} searchQuery={searchQuery} />
        </div>
      </main>
    </div>
  );
}

export default DashboardLayout;
