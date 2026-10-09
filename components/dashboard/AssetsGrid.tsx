import { useState, useMemo, useDeferredValue, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
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
  FolderOpen,
  Copy,
  Download,
  Flame,
  MoreVertical,
  Trash2,
  FolderInput,
} from 'lucide-react';
import { useFileStore } from '../../stores/fileStore';
import { useUserStore } from '../../stores/userStore';
import { useProjectsStore } from '../../stores/projectsStore';
import { buildLibrary, type PlacedAsset } from '@/lib/pipeline/canvasPictures';
import { useCanvasPictures } from '@/hooks/useCanvasPictures';
import { ancestorPaths } from '@/lib/search/fileSuggestions';
import { slugifyProjectName } from '@/utils/project';
import styles from './AssetsGrid.module.css';
import type { Asset, AssetType, FileNode } from '../../types';

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

const DISMISS_KEY = 'ars-library-dismissed';

function readDismissed(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: string[]) {
  localStorage.setItem(DISMISS_KEY, JSON.stringify(ids));
}

/** JPEG, PNG, and so on — the file format, separate from the asset category. */
function fileKindLabel(asset: { name: string; type: string; thumbnail?: string; metadata?: { mimeType?: string } }): string {
  const mime = asset.metadata?.mimeType?.split('/')[1];
  if (mime) return mime.replace('jpeg', 'jpg').toUpperCase();
  const data = asset.thumbnail?.match(/^data:(?:image|video|audio)\/([a-z0-9+.-]+)/i);
  if (data) return data[1].replace('jpeg', 'jpg').split('+')[0].toUpperCase();
  const named = asset.name.match(/\.([a-z0-9]{2,5})(?:\b|$)/i);
  if (named) return named[1].toUpperCase();
  return asset.type.toUpperCase();
}

function parentFolder(path: string): string | null {
  if (!path.startsWith('/')) return null;
  const parent = path.split('/').slice(0, -1).join('/');
  return parent && parent !== '/' ? parent : null;
}

function listFolders(nodes: FileNode[], into: { path: string; label: string }[] = []): { path: string; label: string }[] {
  for (const node of nodes) {
    if (node.type !== 'folder' || node.path === '/') continue;
    into.push({ path: node.path, label: node.path.split('/').filter(Boolean).join(' / ') });
    if (node.children?.length) listFolders(node.children, into);
  }
  return into;
}

function projectIdForFolder(folderPath: string, projects: { id: string; name: string }[]): string | undefined {
  if (!folderPath.startsWith('/projects/')) return undefined;
  const slug = folderPath.split('/').filter(Boolean)[1];
  if (!slug) return undefined;
  return projects.find((project) => slugifyProjectName(project.name) === slug)?.id;
}

function folderTitle(path: string): string {
  const part = path.split('/').filter(Boolean).pop() || 'Folder';
  return part.charAt(0).toUpperCase() + part.slice(1);
}

const PENDING_SEARCH_KEY = 'ars-pending-file-search';

function unusedName(folderPath: string, name: string): string {
  const store = useFileStore.getState();
  const dot = name.lastIndexOf('.');
  const hasExt = dot > 0 && name.length - dot <= 5;
  const stem = hasExt ? name.slice(0, dot) : name;
  const ext = hasExt ? name.slice(dot) : '';
  let candidate = `${stem} copy${ext}`;
  let n = 2;
  while (store.findNodeByPath(`${folderPath}/${candidate}`)) {
    candidate = `${stem} copy ${n}${ext}`;
    n += 1;
  }
  return candidate;
}

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
  const router = useRouter();
  const rootNodes = useFileStore((s) => s.rootNodes);
  const findNodeByPath = useFileStore((s) => s.findNodeByPath);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const allProjects = useMemo(() => {
    const map = new Map<string, string>();
    map.set(currentProject.id, currentProject.name);
    recentProjects.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [currentProject, recentProjects]);

  const canvasProjects = useCanvasPictures();
  const projectCards = useProjectsStore((s) => s.projects);
  const folderAssets = useMemo(() => Array.from(assets.values()), [assets]);
  const allAssets = useMemo(
    () => buildLibrary(
      folderAssets,
      canvasProjects,
      projectCards.map((project) => ({ id: project.id, name: project.name })),
    ),
    [folderAssets, canvasProjects, projectCards],
  );
  const listedAssets = useMemo(
    () => allAssets.filter((asset) => !dismissed.includes(asset.id)),
    [allAssets, dismissed],
  );
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
    const c = { all: listedAssets.length, image: 0, video: 0, audio: 0, text: 0, templates: 0 };
    listedAssets.forEach((a) => {
      if (a.type in c) c[a.type as keyof typeof c]++;
      if (a.type === 'prompt' && a.metadata?.templateId) c.templates++;
    });
    return c;
  }, [listedAssets]);

  const filteredAssets = useMemo(() => {
    let result = listedAssets;

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
          (a.metadata?.source || '').toLowerCase().includes(query) ||
          a.placeLabel.toLowerCase().includes(query) ||
          a.placeDetail.toLowerCase().includes(query)
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
  }, [listedAssets, filterType, deferredSearchQuery, sortBy, sortOrder]);

  const templateMetrics = useMemo(() => {
    const templateAssets = listedAssets.filter((a) => a.type === 'prompt' && a.metadata?.templateId);
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
  }, [templates, listedAssets]);

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

  const folders = useMemo(() => listFolders(rootNodes), [rootNodes]);

  useEffect(() => {
    if (!menuId && !transferOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-asset-menu]') || target.closest('[data-transfer]')) return;
      setMenuId(null);
      setTransferOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menuId, transferOpen]);

  const hideFromLibrary = useCallback((ids: string[]) => {
    setDismissed((current) => {
      const next = [...new Set([...current, ...ids])];
      writeDismissed(next);
      return next;
    });
  }, []);

  const openFolder = useCallback((asset: PlacedAsset) => {
    const folder = parentFolder(asset.path || '');
    const store = useFileStore.getState();
    const linkedProject = asset.metadata?.projectIds?.find((id) => projectCards.some((project) => project.id === id));
    const host = linkedProject || projectCards[0]?.id || currentProject.id;
    if (folder && store.findNodeByPath(folder)) {
      for (const prefix of ancestorPaths(folder)) store.expandPath(prefix);
      store.expandPath(folder);
      store.selectPath(folder);
      const ownerId = projectIdForFolder(folder, projectCards) || host;
      if (ownerId) void router.push(`/project/${ownerId}`);
      return;
    }
    if (asset.placeLabel === 'No project') {
      sessionStorage.setItem(PENDING_SEARCH_KEY, 'No project');
      window.dispatchEvent(new CustomEvent('ars-open-file-search', { detail: { query: 'No project' } }));
      if (host) void router.push(`/project/${host}`);
      return;
    }
    if (host) void router.push(`/project/${host}`);
  }, [currentProject.id, projectCards, router]);

  const placeCopy = useCallback((asset: PlacedAsset, folderPath: string) => {
    const store = useFileStore.getState();
    if (!store.findNodeByPath(folderPath)) return false;
    const name = unusedName(folderPath, asset.name);
    const projectId = projectIdForFolder(folderPath, projectCards);
    const copy: Asset = {
      id: crypto.randomUUID(),
      name,
      type: asset.type,
      path: `${folderPath}/${name}`,
      thumbnail: asset.thumbnail,
      size: asset.size,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      metadata: {
        ...asset.metadata,
        projectIds: projectId ? [projectId] : [],
      },
    };
    store.addAssetToFolder(copy, folderPath);
    return true;
  }, [projectCards]);

  const copyAssets = useCallback((assetsToCopy: PlacedAsset[]) => {
    let placed = 0;
    for (const asset of assetsToCopy) {
      const parent = parentFolder(asset.path || '');
      const dest = parent && findNodeByPath(parent) ? parent : (findNodeByPath('/imports') ? '/imports' : null);
      if (dest && placeCopy(asset, dest)) placed += 1;
    }
    if (placed > 0) {
      setImportSuccess(`${placed} cop${placed === 1 ? 'y' : 'ies'} added`);
      setTimeout(() => setImportSuccess(null), 3000);
    }
    setMenuId(null);
  }, [findNodeByPath, placeCopy]);

  const transferAssets = useCallback((assetsToMove: PlacedAsset[], folderPath: string) => {
    const store = useFileStore.getState();
    let moved = 0;
    const dropped: string[] = [];
    for (const asset of assetsToMove) {
      const path = asset.path || '';
      if (path.startsWith('/') && store.findNodeByPath(path)) {
        if (store.moveNode(path, folderPath)) {
          moved += 1;
          const projectId = projectIdForFolder(folderPath, projectCards);
          const existing = store.getAsset(asset.id);
          if (existing) {
            store.updateAsset(asset.id, {
              metadata: { ...existing.metadata, projectIds: projectId ? [projectId] : [] },
            });
          }
        }
        continue;
      }
      if (placeCopy(asset, folderPath)) {
        moved += 1;
        dropped.push(asset.id);
      }
    }
    if (dropped.length) hideFromLibrary(dropped);
    setSelected(new Set());
    setTransferOpen(false);
    setMenuId(null);
    if (moved > 0) {
      setImportSuccess(`${moved} asset${moved === 1 ? '' : 's'} moved to ${folderPath}`);
      setTimeout(() => setImportSuccess(null), 3000);
    } else {
      setImportError('Nothing could be moved into that folder');
    }
  }, [hideFromLibrary, placeCopy, projectCards]);

  const deleteAssets = useCallback((assetsToDelete: PlacedAsset[]) => {
    if (assetsToDelete.length > 1) {
      const confirmed = window.confirm(`Delete ${assetsToDelete.length} assets?`);
      if (!confirmed) return;
    }
    const store = useFileStore.getState();
    const dropped: string[] = [];
    for (const asset of assetsToDelete) {
      const path = asset.path || '';
      if (path.startsWith('/') && store.findNodeByPath(path)) {
        store.deleteNode(path);
        continue;
      }
      if (store.getAsset(asset.id)) {
        store.removeAsset(asset.id);
        continue;
      }
      dropped.push(asset.id);
    }
    if (dropped.length) hideFromLibrary(dropped);
    setSelected((current) => {
      const next = new Set(current);
      assetsToDelete.forEach((asset) => next.delete(asset.id));
      return next;
    });
    setMenuId(null);
  }, [hideFromLibrary]);

  const toggleSelected = useCallback((id: string, index: number, shift: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (shift && anchorIndex != null) {
        const [start, end] = anchorIndex < index ? [anchorIndex, index] : [index, anchorIndex];
        for (let i = start; i <= end; i += 1) {
          const item = filteredAssets[i];
          if (item) next.add(item.id);
        }
        return next;
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!shift) setAnchorIndex(index);
  }, [anchorIndex, filteredAssets]);

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

        {filteredAssets.map((asset, index) => {
          const meta = asset.metadata;
          const isTemplate = asset.type === 'prompt' && !!asset.metadata?.templateId;
          const typeColor = isTemplate ? '#ec4899' : (TYPE_COLORS[asset.type] || '#6b7280');
          const variationCount = meta?.variationIds?.length || 0;
          const unassigned = asset.placeLabel === 'No project';
          const projectIds = meta?.projectIds || [];
          const fileSize = meta?.fileSize || asset.size || 0;
          const folder = parentFolder(asset.path || '');
          const folderReady = Boolean(folder && findNodeByPath(folder));
          const projectNames = [...new Set([
            ...projectIds.map((id) => allProjects.get(id) || projectCards.find((project) => project.id === id)?.name),
            !unassigned && asset.placeDetail && asset.placeDetail !== 'Not on a current project' ? asset.placeDetail : undefined,
          ].filter((name): name is string => Boolean(name)))];
          const chipLabel = unassigned
            ? 'No project'
            : asset.placeLabel === 'Canvas'
              ? 'Canvas'
              : (asset.placeDetail || asset.placeLabel);
          const placeButtonLabel = unassigned
            ? 'Not on a current project'
            : folderReady && folder
              ? folderTitle(folder)
              : (asset.placeDetail || asset.placeLabel);
          const extraProjects = projectNames.filter((name) => name !== placeButtonLabel);
          const isSelected = selected.has(asset.id);
          const menuTargets = isSelected && selected.size > 1
            ? filteredAssets.filter((item) => selected.has(item.id))
            : [asset];

          return (
            <div
              key={asset.id}
              className={`${styles.assetCard} ${isSelected ? styles.assetCardSelected : ''}`}
              onClick={(event) => toggleSelected(asset.id, index, event.shiftKey)}
            >
              <label className={styles.selectPlate} onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  className={styles.selectBox}
                  checked={isSelected}
                  aria-label={`Select ${asset.name}`}
                  onChange={(event) => toggleSelected(asset.id, index, event.nativeEvent instanceof MouseEvent && event.nativeEvent.shiftKey)}
                />
              </label>
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

                <div className={styles.badgeRow}>
                  <span className={styles.typeBadge} style={{ background: typeColor }}>
                    {isTemplate ? 'TEMPLATE' : asset.type.toUpperCase()}
                  </span>
                  <span
                    className={styles.sourceChip}
                    style={{
                      borderColor: unassigned ? '#f59e0b' : `${typeColor}99`,
                      color: unassigned ? '#f59e0b' : '#fff',
                      background: 'rgba(0, 0, 0, 0.62)',
                    }}
                    title={chipLabel}
                  >
                    {chipLabel}
                  </span>
                </div>

                <div className={styles.cornerTools}>
                  <span className={styles.fileKindBadge}>{fileKindLabel(asset)}</span>
                  <button
                    type="button"
                    className={styles.moreButton}
                    data-asset-menu=""
                    aria-label={`Actions for ${asset.name}`}
                    aria-expanded={menuId === asset.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      setTransferOpen(false);
                      setMenuId((current) => current === asset.id ? null : asset.id);
                    }}
                  >
                    <MoreVertical size={14} />
                  </button>
                </div>
                {menuId === asset.id && (
                  <div className={styles.cardMenu} data-asset-menu="" role="menu">
                    <button type="button" role="menuitem" onClick={(event) => { event.stopPropagation(); setMenuId(null); openFolder(asset); }}>
                      <FolderOpen size={13} /> Open folder
                    </button>
                    <button type="button" role="menuitem" onClick={(event) => { event.stopPropagation(); setMenuId(null); setSelected(new Set(menuTargets.map((item) => item.id))); setTransferOpen(true); }}>
                      <FolderInput size={13} /> Transfer{menuTargets.length > 1 ? ` ${menuTargets.length}` : ''}
                    </button>
                    <button type="button" role="menuitem" onClick={(event) => { event.stopPropagation(); copyAssets(menuTargets); }}>
                      <Copy size={13} /> Copy{menuTargets.length > 1 ? ` ${menuTargets.length}` : ''}
                    </button>
                    <button type="button" role="menuitem" className={styles.menuDanger} onClick={(event) => { event.stopPropagation(); deleteAssets(menuTargets); }}>
                      <Trash2 size={13} /> Delete{menuTargets.length > 1 ? ` ${menuTargets.length}` : ''}
                    </button>
                  </div>
                )}

              </div>

              <div className={styles.assetInfo}>
                <h3 className={styles.assetName} title={asset.name}>
                  {asset.name}
                </h3>

                <div className={styles.assetMeta}>
                  {meta?.width && meta?.height ? (
                    <span className={styles.metaChip}>{meta.width}&times;{meta.height}</span>
                  ) : null}
                  {fileSize > 0 && (
                    <span className={styles.metaChip}>{formatFileSize(fileSize)}</span>
                  )}
                  {variationCount > 1 && (
                    <span className={styles.metaChip}>{variationCount} versions</span>
                  )}
                  {isTemplate && (
                    <>
                      <span className={styles.metaChip} title="Template popularity"><Flame size={10} /> {meta?.templateUsageCount || 0}</span>
                      <span className={styles.metaChip} title="Template downloads"><Download size={10} /> {meta?.templateDownloads || 0}</span>
                    </>
                  )}
                </div>

                <div className={styles.projectsRow}>
                  <button
                    type="button"
                    className={styles.folderButton}
                    title={folderReady && folder ? `Open ${folder}` : unassigned ? 'Open the files that are not on a project' : 'Open the project'}
                    onClick={(event) => {
                      event.stopPropagation();
                      openFolder(asset);
                    }}
                  >
                    <FolderOpen size={12} />
                    <span>{placeButtonLabel}</span>
                  </button>
                </div>
                {extraProjects.length > 0 && (
                  <div className={styles.projectTags}>
                    {extraProjects.map((name) => (
                      <span key={name} className={styles.projectTag}>{name}</span>
                    ))}
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

      {selected.size > 0 && (
        <div className={styles.selectionBar} data-transfer="">
          <span className={styles.selectionCount}>{selected.size} selected</span>
          <button type="button" onClick={() => setTransferOpen((open) => !open)}>
            <FolderInput size={13} /> Transfer
          </button>
          <button type="button" onClick={() => copyAssets(filteredAssets.filter((asset) => selected.has(asset.id)))}>
            <Copy size={13} /> Copy
          </button>
          <button type="button" className={styles.menuDanger} onClick={() => deleteAssets(filteredAssets.filter((asset) => selected.has(asset.id)))}>
            <Trash2 size={13} /> Delete
          </button>
          <button type="button" onClick={() => { setSelected(new Set()); setTransferOpen(false); }}>
            Clear
          </button>
          {transferOpen && (
            <div className={styles.transferMenu} data-transfer="" role="menu">
              {folders.length === 0 && <div className={styles.transferEmpty}>No folders yet</div>}
              {folders.map((folder) => (
                <button
                  key={folder.path}
                  type="button"
                  role="menuitem"
                  onClick={() => transferAssets(filteredAssets.filter((asset) => selected.has(asset.id)), folder.path)}
                >
                  {folder.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
