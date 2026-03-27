import { useState, useMemo, useDeferredValue, useCallback, useRef, useEffect } from 'react';
import {
  Clock,
  Image as ImageIcon,
  FileText,
  Video,
  Music,
  Plus,
  HardDrive,
  AlertTriangle,
  X,
  Film,
  Headphones,
  FileType,
  Loader2,
  Layers,
  FolderOpen,
  Eye,
  Copy,
  Download,
  Flame,
} from 'lucide-react';
import { useFileStore } from '../../stores/fileStore';
import { useUserStore } from '../../stores/userStore';
import styles from './AssetsGrid.module.css';
import type { Asset, AssetType } from '../../types';

const ACCEPTED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.tiff', '.tif', '.avif',
  '.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v', '.ogv', '.flv', '.wmv',
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.aiff', '.opus',
  '.txt', '.md', '.json', '.csv', '.srt', '.vtt',
].join(',');

interface AssetsGridProps {
  searchQuery?: string;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

const TYPE_COLORS: Record<string, string> = {
  image: '#a855f7',
  video: '#3b82f6',
  audio: '#f59e0b',
  text: '#10b981',
  prompt: '#ec4899',
  folder: '#6b7280',
};

const SOURCE_LABELS: Record<string, string> = {
  imported: 'Imported',
  generated: 'Generated',
  duplicated: 'Duplicated',
  modified: 'Modified',
};

interface PromptTemplate {
  id: string;
  name: string;
  category?: string;
}

export function AssetsGrid({ searchQuery = '' }: AssetsGridProps) {
  const assets = useFileStore((s) => s.assets);
  const importLocalFiles = useFileStore((s) => s.importLocalFiles);
  const recentProjects = useUserStore((s) => s.recentProjects);
  const currentProject = useUserStore((s) => s.currentProject);
  const [filterType, setFilterType] = useState<AssetType | 'all' | 'templates'>('all');
  const [sortBy, setSortBy] = useState<'modifiedAt' | 'createdAt' | 'name' | 'size'>('modifiedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allProjects = useMemo(() => {
    const map = new Map<string, string>();
    map.set(currentProject.id, currentProject.name);
    recentProjects.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [currentProject, recentProjects]);

  const allAssets = useMemo(() => Array.from(assets.values()), [assets]);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    setTemplatesLoading(true);
    fetch('/api/prompts/templates?pageSize=200')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTemplates(d?.data ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c = { all: allAssets.length, image: 0, video: 0, audio: 0, text: 0, templates: 0 };
    allAssets.forEach((a) => {
      if (a.type in c) c[a.type as keyof typeof c]++;
      if (a.type === 'prompt' && a.metadata?.templateId) c.templates++;
    });
    return c;
  }, [allAssets]);

  const filteredAssets = useMemo(() => {
    let result = allAssets;

    if (filterType !== 'all' && filterType !== 'templates') {
      result = result.filter((a) => a.type === filterType);
    }
    if (filterType === 'templates') {
      result = result.filter((a) => a.type === 'prompt' && !!a.metadata?.templateId);
    }

    const query = deferredSearchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          (a.metadata?.prompt || '').toLowerCase().includes(query) ||
          (a.metadata?.mimeType || '').toLowerCase().includes(query) ||
          (a.metadata?.source || '').toLowerCase().includes(query)
      );
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'modifiedAt':
          comparison = a.modifiedAt - b.modifiedAt;
          break;
        case 'createdAt':
          comparison = a.createdAt - b.createdAt;
          break;
        case 'size':
          comparison = (a.metadata?.fileSize || a.size || 0) - (b.metadata?.fileSize || b.size || 0);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [allAssets, filterType, deferredSearchQuery, sortBy, sortOrder]);

  const templateMetrics = useMemo(() => {
    const templateAssets = allAssets.filter((a) => a.type === 'prompt' && a.metadata?.templateId);
    return templates
      .map((t) => {
        const linked = templateAssets.find((a) => a.metadata?.templateId === t.id);
        return {
          id: t.id,
          name: t.name,
          category: t.category || 'general',
          popularity: linked?.metadata?.templateUsageCount ?? linked?.metadata?.usageCount ?? 0,
          downloads: linked?.metadata?.templateDownloads ?? 0,
        };
      })
      .sort((a, b) => b.popularity - a.popularity || b.downloads - a.downloads)
      .slice(0, 8);
  }, [templates, allAssets]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFilesSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;

      setImporting(true);
      setImportError(null);
      setImportSuccess(null);

      try {
        const files = Array.from(fileList);
        const imported = await importLocalFiles(files);

        if (imported.length > 0) {
          const types = [...new Set(imported.map((a) => a.type))];
          setImportSuccess(
            `${imported.length} asset${imported.length > 1 ? 's' : ''} imported (${types.join(', ')})`
          );
          setTimeout(() => setImportSuccess(null), 4000);
        }

        if (imported.length < files.length) {
          const skipped = files.length - imported.length;
          setImportError(`${skipped} file(s) could not be processed`);
        }
      } catch (err) {
        setImportError('Import failed. Please try again.');
        console.error('Import error:', err);
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [importLocalFiles]
  );

  const getIconForType = (type: AssetType) => {
    switch (type) {
      case 'image': return <ImageIcon size={16} />;
      case 'video': return <Film size={16} />;
      case 'audio': return <Headphones size={16} />;
      case 'text': return <FileType size={16} />;
      default: return <FileText size={16} />;
    }
  };

  return (
    <div className={styles.container}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFilesSelected}
        style={{ display: 'none' }}
      />

      {importError && (
        <div className={styles.errorBanner}>
          <AlertTriangle size={14} />
          <span>{importError}</span>
          <button className={styles.bannerClose} onClick={() => setImportError(null)}>
            <X size={12} />
          </button>
        </div>
      )}

      {importSuccess && (
        <div className={styles.successBanner}>
          <span>{importSuccess}</span>
          <button className={styles.bannerClose} onClick={() => setImportSuccess(null)}>
            <X size={12} />
          </button>
        </div>
      )}

      <div className={styles.filters}>
        <button
          className={`${styles.filterButton} ${filterType === 'all' ? styles.filterActive : ''}`}
          onClick={() => setFilterType('all')}
        >
          All <span className={styles.filterCount}>{counts.all}</span>
        </button>
        <button
          className={`${styles.filterButton} ${filterType === 'image' ? styles.filterActive : ''}`}
          onClick={() => setFilterType('image')}
        >
          <ImageIcon size={14} /> Images <span className={styles.filterCount}>{counts.image}</span>
        </button>
        <button
          className={`${styles.filterButton} ${filterType === 'video' ? styles.filterActive : ''}`}
          onClick={() => setFilterType('video')}
        >
          <Video size={14} /> Videos <span className={styles.filterCount}>{counts.video}</span>
        </button>
        <button
          className={`${styles.filterButton} ${filterType === 'audio' ? styles.filterActive : ''}`}
          onClick={() => setFilterType('audio')}
        >
          <Music size={14} /> Audio <span className={styles.filterCount}>{counts.audio}</span>
        </button>
        <button
          className={`${styles.filterButton} ${filterType === 'text' ? styles.filterActive : ''}`}
          onClick={() => setFilterType('text')}
        >
          <FileText size={14} /> Text <span className={styles.filterCount}>{counts.text}</span>
        </button>
        <button
          className={`${styles.filterButton} ${filterType === 'templates' ? styles.filterActive : ''}`}
          onClick={() => setFilterType('templates')}
        >
          <FileText size={14} /> Templates <span className={styles.filterCount}>{counts.templates}</span>
        </button>

        <label className={styles.filterSelectLabel}>
          Sort
          <select
            className={styles.filterSelect}
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split(':') as [string, string];
              setSortBy(newSortBy as typeof sortBy);
              setSortOrder(newSortOrder as typeof sortOrder);
            }}
          >
            <option value="modifiedAt:desc">Newest</option>
            <option value="modifiedAt:asc">Oldest</option>
            <option value="name:asc">Name (A-Z)</option>
            <option value="name:desc">Name (Z-A)</option>
            <option value="size:desc">Largest</option>
            <option value="size:asc">Smallest</option>
            <option value="createdAt:desc">Created (newest)</option>
            <option value="createdAt:asc">Created (oldest)</option>
          </select>
        </label>
      </div>

      <div className={styles.templateLeaderboard}>
        <div className={styles.templateLeaderboardHeader}>
          <strong>Template Library</strong>
          <span>{templatesLoading ? 'loading…' : `${templateMetrics.length} tracked`}</span>
        </div>
        {templateMetrics.length === 0 ? (
          <div className={styles.templateLeaderboardEmpty}>No template stats yet. Create templates from the editor.</div>
        ) : (
          <div className={styles.templateLeaderboardList}>
            {templateMetrics.map((tpl) => (
              <div key={tpl.id} className={styles.templateLeaderboardRow}>
                <div className={styles.templateLeaderboardMain}>
                  <span className={styles.templateLeaderboardName}>{tpl.name}</span>
                  <span className={styles.templateLeaderboardCategory}>{tpl.category}</span>
                </div>
                <div className={styles.templateLeaderboardStats}>
                  <span title="Popularity"><Flame size={11} /> {tpl.popularity}</span>
                  <span title="Downloads"><Download size={11} /> {tpl.downloads}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.grid}>
        <button
          className={styles.importCard}
          onClick={handleImportClick}
          disabled={importing}
        >
          {importing ? (
            <Loader2 size={28} className={styles.spinner} />
          ) : (
            <Plus size={28} />
          )}
          <span>{importing ? 'Importing...' : 'Import Asset'}</span>
          <span className={styles.importHint}>Images, Videos, Audio, Text</span>
        </button>

        {filteredAssets.map((asset) => {
          const meta = asset.metadata;
          const isTemplate = asset.type === 'prompt' && !!asset.metadata?.templateId;
          const typeColor = isTemplate ? '#ec4899' : (TYPE_COLORS[asset.type] || '#6b7280');
          const usageCount = meta?.usageCount || 0;
          const variationCount = meta?.variationIds?.length || 0;
          const childCount = meta?.childAssetIds?.length || 0;
          const projectIds = meta?.projectIds || [];
          const source = meta?.source;
          const fileSize = meta?.fileSize || asset.size || 0;

          return (
            <div key={asset.id} className={styles.assetCard}>
              <div className={styles.assetThumbnail}>
                {asset.thumbnail ? (
                  <img src={asset.thumbnail} alt={asset.name} loading="lazy" />
                ) : (
                  <div className={styles.assetPlaceholder}>
                    {getIconForType(asset.type)}
                  </div>
                )}

                {meta?.duration != null && meta.duration > 0 && (
                  <span className={styles.durationBadge}>
                    {formatDuration(meta.duration)}
                  </span>
                )}

                <span className={styles.typeBadge} style={{ background: typeColor }}>
                  {isTemplate ? 'TEMPLATE' : asset.type.toUpperCase()}
                </span>

                {fileSize > 0 && (
                  <span className={styles.sizeBadge}>
                    {formatFileSize(fileSize)}
                  </span>
                )}
              </div>

              <div className={styles.assetInfo}>
                <h3 className={styles.assetName} title={asset.name}>
                  {asset.name}
                </h3>

                <div className={styles.assetMeta}>
                  {meta?.width && meta?.height ? (
                    <span className={styles.metaChip}>
                      {meta.width}&times;{meta.height}
                    </span>
                  ) : null}

                  {source && (
                    <span
                      className={styles.sourceChip}
                      style={{ borderColor: `${typeColor}60`, color: typeColor }}
                    >
                      {SOURCE_LABELS[source] || source}
                    </span>
                  )}

                  {meta?.mimeType && (
                    <span className={styles.mimeChip}>{meta.mimeType.split('/')[1] || meta.mimeType}</span>
                  )}
                </div>

                {/* Stats row */}
                <div className={styles.statsRow}>
                  <span
                    className={`${styles.statItem} ${usageCount > 0 ? styles.statActive : ''}`}
                    title={`Used ${usageCount} time${usageCount !== 1 ? 's' : ''}`}
                  >
                    <Eye size={11} /> {usageCount}
                  </span>
                  <span
                    className={`${styles.statItem} ${variationCount > 0 ? styles.statActive : ''}`}
                    title={`${variationCount} variation${variationCount !== 1 ? 's' : ''}`}
                  >
                    <Copy size={11} /> {variationCount}
                  </span>
                  <span
                    className={`${styles.statItem} ${childCount > 0 ? styles.statActive : ''}`}
                    title={`${childCount} child asset${childCount !== 1 ? 's' : ''}`}
                  >
                    <Layers size={11} /> {childCount}
                  </span>
                  {isTemplate && (
                    <>
                      <span className={`${styles.statItem} ${(meta?.templateUsageCount || 0) > 0 ? styles.statActive : ''}`} title="Template popularity">
                        <Flame size={11} /> {meta?.templateUsageCount || 0}
                      </span>
                      <span className={`${styles.statItem} ${(meta?.templateDownloads || 0) > 0 ? styles.statActive : ''}`} title="Template downloads">
                        <Download size={11} /> {meta?.templateDownloads || 0}
                      </span>
                    </>
                  )}
                </div>

                {/* Projects row */}
                {projectIds.length > 0 && (
                  <div className={styles.projectsRow}>
                    <FolderOpen size={10} />
                    {projectIds.slice(0, 3).map((pid) => (
                      <span key={pid} className={styles.projectTag}>
                        {allProjects.get(pid) || pid.slice(0, 8)}
                      </span>
                    ))}
                    {projectIds.length > 3 && (
                      <span className={styles.projectMore}>+{projectIds.length - 3}</span>
                    )}
                  </div>
                )}

                <div className={styles.assetFooter}>
                  <span className={styles.timeAgo}>
                    <Clock size={11} />
                    {relativeTime(asset.modifiedAt)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAssets.length === 0 && !importing && (
        <div className={styles.empty}>
          <HardDrive size={40} strokeWidth={1} />
          <p>No assets yet</p>
          <span className={styles.emptyHint}>
            Click <strong>Import Asset</strong> to add images, videos, audio, or text files.
          </span>
        </div>
      )}
    </div>
  );
}
