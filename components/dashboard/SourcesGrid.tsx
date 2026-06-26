/**
 * SourcesGrid — base materials to import or use before generating assets.
 */

import { useRef, useMemo, useCallback, useEffect, type ReactNode } from 'react';
import {
  Upload,
  Library,
  FileText,
  User,
  Music,
  Video,
  Link2,
  Sparkles,
  Plus,
} from 'lucide-react';
import { useFileStore } from '@/stores/fileStore';
import { useProductionStore } from '@/stores/productionStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useLogStore } from '@/stores/logStore';
import { useUserStore } from '@/stores/userStore';
import { useProjectsStore } from '@/stores/projectsStore';
import { buildSourceBuckets } from '@/utils/dashboardSources';
import type { DashboardSourceId } from '@/types/dashboard';
import { WORKSPACE_ROOT_PATHS } from '@/constants/workspace';
import styles from './SourcesGrid.module.css';

const SOURCE_ICONS: Record<DashboardSourceId, ReactNode> = {
  imports: <Upload size={22} />,
  library: <Library size={22} />,
  prompts: <FileText size={22} />,
  characters: <User size={22} />,
  audio: <Music size={22} />,
  video: <Video size={22} />,
  production_refs: <Link2 size={22} />,
};

interface SourcesGridProps {
  onOpenProject: (projectId: string) => void;
}

export function SourcesGrid({ onOpenProject }: SourcesGridProps) {
  const assets = useFileStore((s) => s.assets);
  const importSourceFiles = useFileStore((s) => s.importSourceFiles);
  const createPromptAsset = useFileStore((s) => s.createPromptAsset);
  const initializeFileStructure = useFileStore((s) => s.initializeFileStructure);
  const rootNodes = useFileStore((s) => s.rootNodes);
  const records = useProductionStore((s) => s.records);
  const sourceScope = useDashboardStore((s) => s.filters.sourceScope);
  const setSourceScope = useDashboardStore((s) => s.setSourceScope);
  const log = useLogStore((s) => s.log);
  const incrementStat = useUserStore((s) => s.incrementStat);
  const projects = useProjectsStore((s) => s.projects);
  const currentProject = useUserStore((s) => s.currentProject);

  const importInputRef = useRef<HTMLInputElement>(null);
  const importTargetRef = useRef<'imports' | 'library'>('imports');

  useEffect(() => {
    if (rootNodes.length === 0) {
      initializeFileStructure(currentProject.name);
    }
  }, [rootNodes.length, initializeFileStructure, currentProject.name]);

  const productionSources = useMemo(
    () => Object.values(records).flatMap((r) => r.sources),
    [records]
  );

  const buckets = useMemo(
    () => buildSourceBuckets(assets.values(), productionSources),
    [assets, productionSources]
  );

  const handleImportClick = useCallback((target: 'imports' | 'library') => {
    importTargetRef.current = target;
    importInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      const target = importTargetRef.current;
      const imported = await importSourceFiles(files, target);
      log('file_import', `Imported ${imported.length} source file(s) to ${target}`, {
        count: imported.length,
        target,
      });
      incrementStat('importsCount');
      setSourceScope(target);
      e.target.value = '';
    },
    [importSourceFiles, log, incrementStat, setSourceScope]
  );

  const handleNewPrompt = useCallback(() => {
    const text = window.prompt('Enter a prompt template to save as a source:');
    if (!text?.trim()) return;
    createPromptAsset(text.trim());
    log('prompt_save', 'Created prompt source from dashboard');
    setSourceScope('prompts');
  }, [createPromptAsset, log, setSourceScope]);

  const handleGenerate = useCallback(() => {
    const project = projects[0];
    if (project) {
      onOpenProject(project.id);
      return;
    }
    onOpenProject(currentProject.id);
  }, [projects, currentProject.id, onOpenProject]);

  const formatCount = (bucket: (typeof buckets)[0]) => {
    if (bucket.id === 'production_refs') {
      return bucket.productionRefCount;
    }
    return bucket.assetCount;
  };

  return (
    <section className={styles.section} aria-labelledby="sources-grid-heading">
      <div className={styles.sectionHeader}>
        <h2 id="sources-grid-heading" className={styles.sectionTitle}>
          Sources
        </h2>
        <p className={styles.sectionSubtitle}>
          Import or create base material — references, prompts, and media — before generating project assets.
        </p>
      </div>

      <div className={styles.actionsRow}>
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => handleImportClick('imports')}
        >
          <Upload size={16} />
          Import to Imports
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => handleImportClick('library')}
        >
          <Library size={16} />
          Import to Library
        </button>
        <button type="button" className={styles.actionButton} onClick={handleNewPrompt}>
          <Plus size={16} />
          New prompt
        </button>
        <button type="button" className={styles.actionButtonPrimary} onClick={handleGenerate}>
          <Sparkles size={16} />
          Generate in project
        </button>
      </div>

      <input
        ref={importInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*,.txt,.md,.json"
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />

      <div className={styles.grid}>
        {buckets.map((bucket) => {
          const count = formatCount(bucket);
          const isActive = sourceScope === bucket.id;
          return (
            <button
              key={bucket.id}
              type="button"
              className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
              onClick={() => setSourceScope(isActive ? 'all' : bucket.id)}
            >
              <div className={styles.thumbnail}>
                {bucket.thumbnail ? (
                  <img src={bucket.thumbnail} alt="" />
                ) : (
                  <div className={styles.placeholderThumb}>{SOURCE_ICONS[bucket.id]}</div>
                )}
              </div>
              <div className={styles.info}>
                <h3 className={styles.name}>{bucket.title}</h3>
                <p className={styles.description}>{bucket.description}</p>
                <div className={styles.meta}>
                  <span className={styles.count}>
                    {count} {bucket.id === 'production_refs' ? 'refs' : 'items'}
                  </span>
                  {bucket.id !== 'production_refs' && (
                    <code className={styles.pathHint}>
                      {bucket.pathPrefix || WORKSPACE_ROOT_PATHS.imports}
                    </code>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
