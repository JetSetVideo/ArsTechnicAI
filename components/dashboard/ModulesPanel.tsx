/**
 * ModulesPanel Component
 * 
 * Displays preinstalled and available modules with install/activate controls.
 */

import { 
  Download, 
  Power, 
  PowerOff, 
  Loader2,
  Image,
  Sparkles,
  Video,
  Volume2,
  Folder,
  Download as DownloadIcon,
  Camera,
  Box,
  User,
  Mic,
  Music,
  MessageCircle,
  Activity,
  Palette,
  Layers,
  Target
} from 'lucide-react';
import { useModulesStore } from '../../stores';
import styles from './ModulesPanel.module.css';

// Icon mapping
const ICON_MAP: Record<string, React.ReactNode> = {
  'image': <Image size={18} />,
  'sparkles': <Sparkles size={18} />,
  'video': <Video size={18} />,
  'volume-2': <Volume2 size={18} />,
  'folder': <Folder size={18} />,
  'download': <DownloadIcon size={18} />,
  'camera': <Camera size={18} />,
  'box': <Box size={18} />,
  'user': <User size={18} />,
  'mic': <Mic size={18} />,
  'music': <Music size={18} />,
  'message-circle': <MessageCircle size={18} />,
  'activity': <Activity size={18} />,
  'palette': <Palette size={18} />,
  'layers': <Layers size={18} />,
  'target': <Target size={18} />,
};

interface ModulesPanelProps {
  searchQuery?: string;
}

export function ModulesPanel({ searchQuery = '' }: ModulesPanelProps) {
  const { 
    getPreinstalledModules,
    getAvailableModules,
    activateModule,
    deactivateModule,
    installModule,
  } = useModulesStore();

  const query = searchQuery.trim().toLowerCase();
  const preinstalled = getPreinstalledModules().filter((module) =>
    !query ||
    module.name.toLowerCase().includes(query) ||
    module.description.toLowerCase().includes(query) ||
    module.tags.some((tag) => tag.toLowerCase().includes(query))
  );
  const available = getAvailableModules().filter((module) =>
    !query ||
    module.name.toLowerCase().includes(query) ||
    module.description.toLowerCase().includes(query) ||
    module.tags.some((tag) => tag.toLowerCase().includes(query))
  );

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Modules</h2>
        <span className={styles.subtitle}>Extensible AI capabilities</span>
      </div>

      {/* Preinstalled Section */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Preinstalled</h3>
        <div className={styles.moduleList}>
          {preinstalled.map((module) => (
            <div key={module.id} className={styles.moduleItem}>
              <div className={styles.moduleIcon}>
                {ICON_MAP[module.icon] || <Box size={18} />}
              </div>
              <div className={styles.moduleInfo}>
                <span className={styles.moduleName}>{module.name}</span>
                <span className={styles.moduleDesc}>{module.description}</span>
              </div>
              <div className={styles.moduleStatus}>
                {module.status === 'active' ? (
                  <button
                    className={`${styles.statusButton} ${styles.active}`}
                    onClick={() => deactivateModule(module.id)}
                    title="Click to deactivate"
                  >
                    <Power size={14} />
                    Active
                  </button>
                ) : (
                  <button
                    className={styles.statusButton}
                    onClick={() => activateModule(module.id)}
                    title="Click to activate"
                  >
                    <PowerOff size={14} />
                    Inactive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Available Section */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Available</h3>
        <div className={styles.moduleList}>
          {available.map((module) => (
            <div key={module.id} className={styles.moduleItem}>
              <div className={styles.moduleIcon}>
                {ICON_MAP[module.icon] || <Box size={18} />}
              </div>
              <div className={styles.moduleInfo}>
                <span className={styles.moduleName}>
                  {module.name}
                  {module.price === 'premium' && (
                    <span className={styles.premiumBadge}>Premium</span>
                  )}
                </span>
                <span className={styles.moduleDesc}>{module.description}</span>
              </div>
              <div className={styles.moduleStatus}>
                {module.status === 'downloading' ? (
                  <button className={`${styles.statusButton} ${styles.downloading}`} disabled>
                    <Loader2 size={14} className={styles.spinner} />
                    {Math.round(module.downloadProgress || 0)}%
                  </button>
                ) : (
                  <button
                    className={`${styles.statusButton} ${styles.install}`}
                    onClick={() => installModule(module.id)}
                  >
                    <Download size={14} />
                    {module.price === 'free' ? 'Install' : 'Get'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ModulesPanel;
