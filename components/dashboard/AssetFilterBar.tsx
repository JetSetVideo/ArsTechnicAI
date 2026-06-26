/**
 * AssetFilterBar — compact filters for asset type and project scope.
 */

import { useMemo } from 'react';
import { FolderKanban, Library } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useProjectsStore } from '@/stores/projectsStore';
import type { DashboardAssetCategory } from '@/types/dashboard';
import styles from './AssetFilterBar.module.css';

const CATEGORY_OPTIONS: { id: DashboardAssetCategory; label: string }[] = [
  { id: 'all', label: 'All types' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
  { id: 'prompt', label: 'Prompts' },
  { id: 'character', label: 'Characters' },
  { id: 'subtitle', label: 'Subtitles' },
  { id: 'scene', label: 'Scenes' },
  { id: 'text', label: 'Text' },
  { id: 'preset', label: 'Presets' },
  { id: 'other', label: 'Other' },
];

export function AssetFilterBar() {
  const filters = useDashboardStore((s) => s.filters);
  const setCategory = useDashboardStore((s) => s.setCategory);
  const setProjectScope = useDashboardStore((s) => s.setProjectScope);
  const projects = useProjectsStore((s) => s.projects);

  const projectOptions = useMemo(
    () => [
      { value: 'all', label: 'All projects' },
      { value: 'library', label: 'Shared library' },
      ...projects.map((p) => ({ value: p.id, label: p.name })),
    ],
    [projects]
  );

  return (
    <div className={styles.filterBarRoot} role="toolbar" aria-label="Asset and project filters">
      <label className={styles.filterBarControl}>
        <span className={styles.filterBarControlLabel}>Type</span>
        <select
          className={styles.filterBarSelect}
          value={filters.category}
          onChange={(e) => setCategory(e.target.value as DashboardAssetCategory)}
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.filterBarControl}>
        <FolderKanban size={13} aria-hidden />
        <span className={styles.filterBarControlLabel}>Project</span>
        <select
          className={styles.filterBarSelect}
          value={filters.projectScope}
          onChange={(e) => setProjectScope(e.target.value)}
        >
          {projectOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className={`${styles.filterBarQuick} ${filters.projectScope === 'library' ? styles.filterBarQuickActive : ''}`}
        onClick={() => setProjectScope('library')}
        title="Shared library assets"
      >
        <Library size={13} />
        Library
      </button>
    </div>
  );
}
