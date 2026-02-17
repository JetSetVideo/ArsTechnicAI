/**
 * DashboardLayout
 * 
 * Main dashboard wrapper with tab navigation, responsive grid, and search integration.
 * Organizes content into tabs: Projects, AI Tools, Agents, Profile, Social
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { 
  FolderOpen, 
  Cpu, 
  Bot, 
  User, 
  Share2, 
  Settings, 
  Search,
  HelpCircle,
} from 'lucide-react';
import { useRouter } from 'next/router';
import styles from './DashboardLayout.module.css';
import { Button } from '../ui';
import { ConnectionBanner } from '../ui/ConnectionBanner';
import { SettingsModal } from './SettingsModal';
import { HelpModal } from './HelpModal';
import type { DashboardTab } from '../../types/dashboard';
import { useProjectSync, saveCanvasState } from '../../hooks/useProjectSync';
import { useUserStore } from '../../stores/userStore';

// Lazy-loaded dashboard components
import { ProjectsGrid } from '../dashboard/ProjectsGrid';
import { ModulesPanel } from '../dashboard/ModulesPanel';
import { TechniquesHighlight } from '../dashboard/TechniquesHighlight';
import { AgentsPanel } from '../dashboard/AgentsPanel';
import { ProfileCard } from '../dashboard/ProfileCard';
import { SocialHistory } from '../dashboard/SocialHistory';
import { ShopSection } from '../dashboard/ShopSection';

// ============================================
// TAB CONFIGURATION
// ============================================

interface TabConfig {
  id: DashboardTab;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  { id: 'projects', label: 'Projects', icon: <FolderOpen size={18} /> },
  { id: 'ai-tools', label: 'AI Tools', icon: <Cpu size={18} /> },
  { id: 'agents', label: 'Agents', icon: <Bot size={18} /> },
  { id: 'profile', label: 'Profile', icon: <User size={18} /> },
  { id: 'social', label: 'Social', icon: <Share2 size={18} /> },
];

// ============================================
// COMPONENT
// ============================================

export function DashboardLayout() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DashboardTab>('projects');
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Project sync hook — bridges userStore + projectsStore
  const { openProjectFromDashboard } = useProjectSync();

  const currentProject = useUserStore((s) => s.currentProject);

  const handleOpenProject = useCallback((projectId: string) => {
    // Save current canvas state before switching
    saveCanvasState(currentProject.id);

    // Sync the project into userStore
    openProjectFromDashboard(projectId);

    // Navigate to editor with project
    router.push(`/?project=${projectId}`);
  }, [router, currentProject.id, openProjectFromDashboard]);

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'projects':
        return (
          <div className={styles.tabContent}>
            <ProjectsGrid onOpenProject={handleOpenProject} searchQuery={searchQuery} />
          </div>
        );
      
      case 'ai-tools':
        return (
          <div className={styles.tabContent}>
            <div className={styles.twoColumnGrid}>
              <ModulesPanel searchQuery={searchQuery} />
              <TechniquesHighlight searchQuery={searchQuery} />
            </div>
            <ShopSection searchQuery={searchQuery} />
          </div>
        );
      
      case 'agents':
        return (
          <div className={styles.tabContent}>
            <AgentsPanel searchQuery={searchQuery} />
          </div>
        );
      
      case 'profile':
        return (
          <div className={styles.tabContent}>
            <ProfileCard />
          </div>
        );
      
      case 'social':
        return (
          <div className={styles.tabContent}>
            <SocialHistory />
          </div>
        );
      
      default:
        return null;
    }
  };

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
              placeholder="Search projects, modules, techniques, agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.headerActions}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenSettings}
              title="Settings"
            >
              <Settings size={18} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHelpOpen(true)}
              title="Help"
            >
              <HelpCircle size={18} />
            </Button>
          </div>
        </div>
      </header>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Tab Navigation */}
      <nav className={styles.tabNav}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content Area */}
      <main className={styles.main}>
        {renderTabContent()}
      </main>

    </div>
  );
}

export default DashboardLayout;
