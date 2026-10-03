/**
 * ProjectsGrid Component
 * 
 * Grid display of user projects with thumbnails, search, and filters.
 */

import { useState, useEffect, useMemo, useCallback, useDeferredValue, useRef } from 'react';
import { useToastStore } from '../../stores/toastStore';
import { SkeletonProjectCard, EmptyState } from '../ui';
import { 
  Plus, 
  Star, 
  StarOff, 
  MoreVertical, 
  Trash2, 
  Copy, 
  FolderOpen,
  Info,
  Layers,
  ArrowUpDown,
  Cloud,
  HardDrive,
  RefreshCcw,
  Edit,
  Image,
  FileText,
  Film,
  Music,
  File,
  ChevronDown,
  Check,
  GripVertical,
  GitBranch,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useProjectsStore } from '../../stores';
import { useUserStore } from '../../stores/userStore';
import { useFileStore } from '../../stores/fileStore';
import { useDashboardStore } from '../../stores/dashboardStore';
import { slugifyProjectName } from '../../utils/project';
import { WORKSPACE_ROOT_PATHS } from '../../constants/workspace';
import { Button } from '../ui';
import styles from './ProjectsGrid.module.css';
import type { Asset, FileNode } from '../../types';
import { formatBytes } from '../../lib/pipeline/ingest';

type FilterPlatform = 'tiktok' | 'instagram' | 'youtube' | 'twitter';
type FilterSource = 'ai-generated' | 'imported' | 'remixed' | 'manual';
type FilterSort = 'recent' | 'alpha' | 'size' | 'published';
interface ExternalFilters {
  platform: FilterPlatform | null;
  source: FilterSource | null;
  sortBy: FilterSort;
}

interface ProjectsGridProps {
  onOpenProject: (projectId: string) => void;
  searchQuery?: string;
  externalFilters?: ExternalFilters;
  triggerNew?: number;
}

const byteCache = new Map<string, number>();

function assetFileUrl(asset: Pick<Asset, 'name' | 'thumbnail'>): string | null {
  if (asset.thumbnail?.startsWith('/')) return asset.thumbnail.split('?')[0];
  if (asset.name) return `/generated/${asset.name}`;
  return null;
}

function storedBytes(asset: Pick<Asset, 'size' | 'metadata'>): number | null {
  const amount = asset.size ?? asset.metadata?.fileSize;
  return amount && amount > 0 ? amount : null;
}

function bytesOf(asset: Pick<Asset, 'name' | 'thumbnail' | 'size' | 'metadata'>): number {
  const stored = storedBytes(asset);
  if (stored) return stored;
  const url = assetFileUrl(asset);
  return url ? byteCache.get(url) ?? 0 : 0;
}

/** Fill in file sizes the library never stored, using the file the card already shows. */
function useMeasuredBytes(assets: Asset[]) {
  const key = assets.map((asset) => `${asset.id}:${storedBytes(asset) ?? ''}`).join('|');
  const [, setVersion] = useState(0);
  useEffect(() => {
    let cancel = false;
    const pending = assets.filter((asset) => {
      const url = assetFileUrl(asset);
      return storedBytes(asset) == null && url != null && !byteCache.has(url);
    });
    if (pending.length === 0) return;
    void Promise.all(pending.map(async (asset) => {
      const url = assetFileUrl(asset);
      if (!url || byteCache.has(url)) return;
      try {
        const response = await fetch(url, { method: 'HEAD' });
        const length = Number(response.headers.get('content-length'));
        if (length > 0) byteCache.set(url, length);
      } catch { /* size stays unknown */ }
    })).then(() => { if (!cancel) setVersion((version) => version + 1); });
    return () => { cancel = true; };
    // `key` already names the asset set; `assets` is the matching snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return bytesOf;
}

type FormatTone = 'image' | 'video' | 'audio' | 'text' | 'folder';

const INTERNAL_TAGS = new Set(['blueprint', 'image', 'video', 'audio', 'full-pipeline', '3d', 'social']);

const FORMAT_OPTIONS: { id: string; label: string; tone: FormatTone; type: string; aspect: string }[] = [
  { id: 'still', label: 'Still', tone: 'image', type: 'generic', aspect: '16:9' },
  { id: 'reel', label: 'Reel', tone: 'video', type: 'short', aspect: '9:16' },
  { id: 'movie', label: 'Movie', tone: 'video', type: 'feature', aspect: '2.35:1' },
  { id: 'video', label: 'Video', tone: 'video', type: 'video', aspect: '16:9' },
  { id: 'script', label: 'Script', tone: 'text', type: 'script', aspect: '16:9' },
  { id: 'comic', label: 'Comic', tone: 'image', type: 'comic', aspect: '4:3' },
  { id: 'storyboard', label: 'Storyboard', tone: 'image', type: 'storyboard', aspect: '16:9' },
  { id: 'audio', label: 'Audio', tone: 'audio', type: 'audio', aspect: '16:9' },
];

const ASPECT_OPTIONS = ['16:9', '9:16', '1:1', '2.35:1', '4:3'];
const PLATFORM_OPTIONS: { id: string; label: string; tone: FormatTone }[] = [
  { id: 'instagram', label: 'Instagram', tone: 'image' },
  { id: 'tiktok', label: 'TikTok', tone: 'video' },
  { id: 'youtube', label: 'YouTube', tone: 'video' },
  { id: 'twitter', label: 'X', tone: 'text' },
  { id: 'facebook', label: 'Facebook', tone: 'text' },
  { id: 'linkedin', label: 'LinkedIn', tone: 'text' },
];
const LOCATION_OPTIONS = ['Studio', 'Interior', 'Exterior', 'City', 'Nature', 'Stage', 'Home'];
const STYLE_OPTIONS = ['Noir', 'Documentary', 'Anime', 'Realistic', 'Painterly', 'Minimal'];
const GENRE_OPTIONS = ['Sci-Fi', 'Drama', 'Comedy', 'Thriller', 'Horror', 'Romance'];
const LENGTH_OPTIONS = ['15s', '30s', '60s', '3 min', '10 min', '90 min'];

function splitList(value?: string): string[] {
  return (value || '').split(',').map((part) => part.trim()).filter(Boolean);
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function formatIdOf(type?: string, aspect?: string): string {
  if (type === 'feature') return 'movie';
  if (type === 'short' || aspect === '9:16') return 'reel';
  if (type === 'video') return 'video';
  if (type === 'script') return 'script';
  if (type === 'comic') return 'comic';
  if (type === 'storyboard') return 'storyboard';
  if (type === 'audio') return 'audio';
  return 'still';
}

function hardwareLabel(device: { platform?: string; hardwareConcurrency?: number; deviceMemory?: number | null } | null): string {
  if (!device) return 'This computer';
  const cores = device.hardwareConcurrency ? `${device.hardwareConcurrency} cores` : null;
  const memory = device.deviceMemory ? `${device.deviceMemory} GB` : null;
  return [device.platform || 'This computer', cores, memory].filter(Boolean).join(' · ');
}

function formatChips(
  project: { type?: string; aspectRatio?: string; tags: string[]; style?: string; genre?: string; length?: string; platforms?: string[]; locations?: string[] },
  assets: Asset[],
): { id: string; label: string; tone: FormatTone }[] {
  const type = project.type;
  const aspect = project.aspectRatio;
  const tags = project.tags;
  const onlyImages = assets.length > 0 && assets.every((asset) => asset.type === 'image');
  const chips: { id: string; label: string; tone: FormatTone }[] = [];

  if (type === 'feature' || (type === 'video' && (aspect === '2.35:1' || aspect === '16:9'))) {
    chips.push({ id: 'movie', label: 'Movie', tone: 'video' });
  } else if (type === 'short' || aspect === '9:16' || tags.includes('social')) {
    chips.push({ id: 'reel', label: 'Reel', tone: 'video' });
  } else if (type === 'video' || tags.includes('video')) {
    chips.push({ id: 'video', label: 'Video', tone: 'video' });
  } else if (type === 'audio' || tags.includes('audio')) {
    chips.push({ id: 'audio', label: 'Audio', tone: 'audio' });
  } else if (type === 'script') {
    chips.push({ id: 'script', label: 'Script', tone: 'text' });
  } else if (type === 'comic') {
    chips.push({ id: 'comic', label: 'Comic', tone: 'image' });
  } else if (type === 'storyboard') {
    chips.push({ id: 'storyboard', label: 'Storyboard', tone: 'image' });
  } else if (tags.includes('3d')) {
    chips.push({ id: '3d', label: '3D', tone: 'folder' });
  } else if (type === 'generic' || tags.includes('image') || tags.includes('full-pipeline') || onlyImages) {
    chips.push({ id: 'still', label: 'Still', tone: 'image' });
  }

  if (aspect) chips.push({ id: 'aspect', label: aspect, tone: chips[0]?.tone ?? 'text' });
  for (const platform of project.platforms ?? []) {
    const known = PLATFORM_OPTIONS.find((option) => option.id === platform);
    chips.push({ id: `platform-${platform}`, label: known?.label ?? platform, tone: known?.tone ?? 'video' });
  }
  for (const location of project.locations ?? []) {
    chips.push({ id: `location-${location}`, label: location, tone: 'folder' });
  }
  for (const style of splitList(project.style)) chips.push({ id: `style-${style}`, label: style, tone: 'text' });
  for (const genre of splitList(project.genre)) chips.push({ id: `genre-${genre}`, label: genre, tone: 'text' });
  if (project.length) chips.push({ id: 'length', label: project.length, tone: 'text' });
  for (const tag of tags) {
    if (!INTERNAL_TAGS.has(tag)) chips.push({ id: `tag-${tag}`, label: tag, tone: 'folder' });
  }
  return chips;
}

const findNodeByPath = (nodes: FileNode[], targetPath: string): FileNode | null => {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, targetPath);
      if (found) return found;
    }
  }
  return null;
};

export function ProjectsGrid({ onOpenProject, searchQuery = '', externalFilters, triggerNew }: ProjectsGridProps) {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const deviceInfo = useUserStore((s) => s.deviceInfo);
  const refreshDeviceInfo = useUserStore((s) => s.refreshDeviceInfo);
  const creatorHandle = (session?.user?.name || session?.user?.email?.split('@')[0] || 'local').replace(/^@/, '');

  useEffect(() => { refreshDeviceInfo(); }, [refreshDeviceInfo]);

  const { 
    getSortedProjects, 
    addProject, 
    updateProject,
    toggleFavorite, 
    deleteProject, 
    duplicateProject,
    getAllTags,
    getNextDefaultName,
    filterTags,
    setFilterTags,
    showFavoritesOnly,
    toggleShowFavoritesOnly,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    deduplicateProjects,
  } = useProjectsStore();

  const toast = useToastStore();
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const pendingDeleteRef = useRef<string | null>(null);

  // Sync externalFilters.sortBy → projectsStore sort state
  useEffect(() => {
    if (!externalFilters) return;
    switch (externalFilters.sortBy) {
      case 'recent':   setSortBy('modifiedAt'); setSortOrder('desc'); break;
      case 'alpha':    setSortBy('name');       setSortOrder('asc');  break;
      case 'size':     setSortBy('modifiedAt'); setSortOrder('desc'); break; // best proxy for asset count
      case 'published': setSortBy('createdAt'); setSortOrder('desc'); break;
    }
  }, [externalFilters?.sortBy, setSortBy, setSortOrder]);

  // Mark projects as loaded after first hydration tick
  useEffect(() => {
    const id = setTimeout(() => setIsLoadingProjects(false), 600);
    return () => clearTimeout(id);
  }, []);

  // Open create modal when parent triggers it
  useEffect(() => {
    if (triggerNew && triggerNew > 0) setShowCreateModal(true);
  }, [triggerNew]);

  const rootNodes = useFileStore((s) => s.rootNodes);
  const assets = useFileStore((s) => s.assets);

  // Sync editor projects into projectsStore on mount/update
  const currentProject = useUserStore((s) => s.currentProject);
  const recentProjects = useUserStore((s) => s.recentProjects);

  useEffect(() => {
    const ensureProject = (id: string, name: string, modifiedAt?: number, createdAt?: number) => {
      const existing = useProjectsStore.getState().getProject(id);
      if (!existing) {
        useProjectsStore.setState((state) => ({
          projects: [
            {
              id,
              name,
              createdAt: createdAt ?? Date.now(),
              modifiedAt: modifiedAt ?? Date.now(),
              assetCount: 0,
              tags: [],
              isFavorite: false,
            },
            ...state.projects.filter((p) => p.id !== id),
          ],
        }));
      } else if (existing.name !== name) {
        useProjectsStore.getState().updateProject(id, { name });
      }
    };

    if (currentProject?.id) {
      ensureProject(
        currentProject.id,
        currentProject.name,
        currentProject.modifiedAt,
        currentProject.createdAt
      );
    }
    recentProjects.forEach((p) => ensureProject(p.id, p.name, p.modifiedAt, p.createdAt));
  }, [currentProject, recentProjects]);

  // Sync project cards with real project folders. Counts follow each project's
  // own generated folder, so a sibling project cannot inherit another's files.
  useEffect(() => {
    useProjectsStore.setState((state) => {
      const projectsRoot = findNodeByPath(rootNodes, WORKSPACE_ROOT_PATHS.projects);
      const projectFolders = (projectsRoot?.children || []).filter((n) => n.type === 'folder');
      const nextProjects = state.projects.map((project) => ({ ...project }));
      let changed = false;
      const now = Date.now();

      for (const projectFolder of projectFolders) {
        const projectSlug = projectFolder.path.split('/').pop() || '';
        const generatedPrefix = `${projectFolder.path}/generated/`;
        const folderAssets = Array.from(assets.values()).filter(
          (asset) => asset.path.startsWith(generatedPrefix)
        );
        const latestImage = folderAssets
          .filter((asset) => asset.type === 'image' && asset.thumbnail)
          .sort((a, b) => b.modifiedAt - a.modifiedAt)[0];

        const existing = nextProjects.find((p) => slugifyProjectName(p.name) === projectSlug);
        if (existing) {
          if (!existing.thumbnail && latestImage?.thumbnail) {
            existing.thumbnail = latestImage.thumbnail;
            changed = true;
          }
          continue;
        }

        changed = true;
        nextProjects.unshift({
          id: `proj-${projectSlug}`,
          name: projectFolder.name,
          createdAt: now,
          modifiedAt: folderAssets.length > 0 ? Math.max(...folderAssets.map((a) => a.modifiedAt)) : now,
          assetCount: folderAssets.length,
          tags: [],
          isFavorite: false,
          thumbnail: latestImage?.thumbnail,
        });
      }

      for (const project of nextProjects) {
        const prefix = `${WORKSPACE_ROOT_PATHS.projects}/${slugifyProjectName(project.name)}/generated/`;
        const count = Array.from(assets.values()).filter((asset) => asset.path.startsWith(prefix)).length;
        if (project.assetCount !== count) {
          project.assetCount = count;
          changed = true;
        }
      }

      if (!changed) return state;
      return { projects: nextProjects };
    });
  }, [rootNodes, assets]);

  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [draftStyles, setDraftStyles] = useState<string[]>([]);
  const [draftGenres, setDraftGenres] = useState<string[]>([]);
  const [draftPlatforms, setDraftPlatforms] = useState<string[]>([]);
  const [draftLocations, setDraftLocations] = useState<string[]>([]);
  const [draftThumbnail, setDraftThumbnail] = useState<string | undefined>(undefined);
  const [newProjectLength, setNewProjectLength] = useState('');
  const [newProjectCharacters, setNewProjectCharacters] = useState('');
  const [newProjectType, setNewProjectType] = useState('generic');
  const [newProjectAspectRatio, setNewProjectAspectRatio] = useState('16:9');
  const [minimumAssets, setMinimumAssets] = useState<number>(0);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<{
    state: 'checking' | 'synced' | 'unauthenticated' | 'offline';
    detail: string;
  }>({
    state: 'checking',
    detail: 'Checking backend sync status...',
  });
  const libraryAssets = useMemo(
    () => Array.from(assets.values()).filter((asset) => asset.path.startsWith(`${WORKSPACE_ROOT_PATHS.library}/`)),
    [assets]
  );
  const latestLibraryUpdateAt = useMemo(
    () => (libraryAssets.length > 0 ? Math.max(...libraryAssets.map((asset) => asset.modifiedAt)) : null),
    [libraryAssets]
  );

  const refreshCloudSyncStatus = useCallback(async () => {
    if (typeof window === 'undefined') return;

    if (!isAuthenticated) {
      setCloudSyncStatus({
        state: 'unauthenticated',
        detail: 'Local only. Sign in to enable cloud sync.',
      });
      return;
    }

    let syncMeta: {
      lastWorkspaceSyncAt?: number;
      lastAssetSyncAt?: number;
      lastSyncError?: string;
    } = {};
    try {
      const syncMetaRaw = localStorage.getItem('ars-technicai-cloud-sync-meta');
      syncMeta = syncMetaRaw ? (JSON.parse(syncMetaRaw) as typeof syncMeta) : {};
    } catch {
      syncMeta = {};
    }

    try {
      const response = await fetch('/api/projects?limit=1');
      if (!response.ok) {
        setCloudSyncStatus({
          state: 'offline',
          detail: syncMeta.lastSyncError || `Backend check failed (${response.status})`,
        });
        return;
      }
      const lastSyncAt = Math.max(syncMeta.lastWorkspaceSyncAt || 0, syncMeta.lastAssetSyncAt || 0);
      setCloudSyncStatus({
        state: 'synced',
        detail: lastSyncAt > 0
          ? `Connected. Last sync ${new Date(lastSyncAt).toLocaleString()}.`
          : 'Connected. Waiting for first sync.',
      });
    } catch {
      setCloudSyncStatus({
        state: 'offline',
        detail: syncMeta.lastSyncError || 'Cannot reach backend API.',
      });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    deduplicateProjects();
  }, [deduplicateProjects, currentProject?.id, recentProjects.length]);

  useEffect(() => {
    void refreshCloudSyncStatus();
  }, [libraryAssets.length, refreshCloudSyncStatus]);
  
  const projectScope = useDashboardStore((s) => s.filters.projectScope);
  const sortedProjects = getSortedProjects();
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const projects = useMemo(() => {
    const query = deferredSearchQuery.trim();
    let scoped = sortedProjects;
    if (projectScope !== 'all' && projectScope !== 'library') {
      scoped = scoped.filter((project) => project.id === projectScope);
    }
    const filteredBySearch = !query
      ? scoped
      : scoped.filter((project) => {
          try {
            const regex = new RegExp(query, 'i');
            return (
              regex.test(project.name) ||
              project.tags.some((tag) => regex.test(tag)) ||
              regex.test(project.description || '')
            );
          } catch (e) {
            // Fallback to simple string match if regex is invalid
            const lowerQuery = query.toLowerCase();
            return (
              project.name.toLowerCase().includes(lowerQuery) ||
              project.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
              (project.description || '').toLowerCase().includes(lowerQuery)
            );
          }
        });
    let filtered = filteredBySearch.filter((project) =>
      project.assetCount >= minimumAssets
    );

    // Apply external platform filter (maps to project.type)
    if (externalFilters?.platform) {
      filtered = filtered.filter((p) => (p.platforms ?? []).includes(externalFilters.platform!));
    }

    // Apply external source filter (project has at least one asset with matching source)
    if (externalFilters?.source) {
      const sourceKey = externalFilters.source === 'ai-generated' ? 'generated' : externalFilters.source;
      filtered = filtered.filter((p) => {
        const slug = slugifyProjectName(p.name);
        const prefix = `/projects/${slug}/generated/`;
        return Array.from(assets.values()).some(
          (a) => a.path.startsWith(prefix) && (a.metadata?.source ?? 'imported') === sourceKey
        );
      });
    }

    return filtered;
  }, [sortedProjects, deferredSearchQuery, minimumAssets, projectScope, externalFilters?.platform, externalFilters?.source, assets]);
  const allTags = getAllTags();

  const resetDraft = () => {
    setNewProjectName('');
    setDraftTags([]);
    setTagDraft('');
    setDraftStyles([]);
    setDraftGenres([]);
    setDraftPlatforms([]);
    setDraftLocations([]);
    setDraftThumbnail(undefined);
    setNewProjectLength('');
    setNewProjectCharacters('');
    setNewProjectType('generic');
    setNewProjectAspectRatio('16:9');
  };

  const handleNewProject = () => {
    setEditingProject(null);
    resetDraft();
    setShowCreateModal(true);
  };

  const handleEditProject = (project: { id: string; name: string; tags: string[]; length?: string; style?: string; genre?: string; characters?: string; type?: string; aspectRatio?: string; platforms?: string[]; locations?: string[]; thumbnail?: string }) => {
    setEditingProject(project.id);
    setNewProjectName(project.name);
    setDraftTags(project.tags.filter((tag) => !INTERNAL_TAGS.has(tag)));
    setTagDraft('');
    setDraftStyles(splitList(project.style));
    setDraftGenres(splitList(project.genre));
    setDraftPlatforms(project.platforms ?? []);
    setDraftLocations(project.locations ?? []);
    setDraftThumbnail(project.thumbnail);
    setNewProjectLength(project.length || '');
    setNewProjectCharacters(project.characters || '');
    setNewProjectType(project.type || 'generic');
    setNewProjectAspectRatio(project.aspectRatio || '16:9');
    setMenuOpen(null);
    setInfoOpen(null);
    setShowCreateModal(true);
  };

  const handleSaveProject = () => {
    const trimmedName = newProjectName.trim();
    const pendingTag = tagDraft.trim();
    const tags = pendingTag && !draftTags.includes(pendingTag) ? [...draftTags, pendingTag] : draftTags;
    const existing = editingProject ? useProjectsStore.getState().getProject(editingProject) : undefined;

    const projectData = {
      name: trimmedName || getNextDefaultName(),
      tags,
      length: newProjectLength,
      style: draftStyles.join(', '),
      genre: draftGenres.join(', '),
      characters: newProjectCharacters,
      type: newProjectType,
      aspectRatio: newProjectAspectRatio,
      platforms: draftPlatforms,
      locations: draftLocations,
      thumbnail: draftThumbnail,
      createdBy: existing?.createdBy || creatorHandle,
      createdOn: existing?.createdOn || hardwareLabel(deviceInfo),
    };

    if (editingProject) {
      updateProject(editingProject, projectData);
      setShowCreateModal(false);
      setEditingProject(null);
    } else {
      const newProject = addProject(projectData);
      setShowCreateModal(false);
      onOpenProject(newProject.id);
    }
  };

  const handleDelete = (id: string) => {
    setMenuOpen(null);
    const project = useProjectsStore.getState().getProject(id);
    const name = project?.name ?? 'this project';
    pendingDeleteRef.current = id;

    toast.addToast({
      type: 'warning',
      title: `Delete "${name}"?`,
      message: 'This removes the project record. Assets on disk are not deleted.',
      duration: 7000,
      action: {
        label: 'Delete',
        onClick: () => {
          if (pendingDeleteRef.current === id) {
            deleteProject(id);
            pendingDeleteRef.current = null;
            toast.success('Project deleted', `"${name}" was removed from your library.`);
          }
        },
      },
    });
  };

  const handleDuplicate = (id: string) => {
    duplicateProject(id);
    setMenuOpen(null);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const formatStamp = (timestamp: number) => new Date(timestamp).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const measuredBytes = useMeasuredBytes(Array.from(assets.values()));

  const [assetDrawerOpen, setAssetDrawerOpen] = useState<string | null>(null);
  const [dragProjectId, setDragProjectId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  
  // Build parent map for hierarchy display
  const parentMap = useMemo(() => {
    const map = new Map<string, string>(); // childId → parentName
    projects.forEach(p => {
      if ((p as any).parentId) {
        const parent = projects.find(pp => pp.id === (p as any).parentId);
        if (parent) map.set(p.id, parent.name);
      }
    });
    return map;
  }, [projects]);

  // Drag-drop project parent/child association
  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.setData('text/plain', projectId);
    e.dataTransfer.effectAllowed = 'move';
    setDragProjectId(projectId);
  };
  
  const handleDragOver = (e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragProjectId && dragProjectId !== projectId) {
      setDropTargetId(projectId);
    }
  };
  
  const handleDragLeave = () => {
    setDropTargetId(null);
  };
  
  const handleDrop = (e: React.DragEvent, targetProjectId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (sourceId && sourceId !== targetProjectId) {
      // Set source project's parent to target project
      updateProject(sourceId, { parentId: targetProjectId } as any);
      // Add source to target's children
      const target = projects.find(p => p.id === targetProjectId);
      if (target) {
        const existingChildren = (target as any).childIds || [];
        if (!existingChildren.includes(sourceId)) {
          updateProject(targetProjectId, { 
            childIds: [...existingChildren, sourceId] 
          } as any);
        }
      }
    }
    setDragProjectId(null);
    setDropTargetId(null);
  };
  
  const handleDragEnd = () => {
    setDragProjectId(null);
    setDropTargetId(null);
  };

  const getProjectAssets = useCallback((projectName: string) => {
    const projectSlug = slugifyProjectName(projectName);
    const generatedPrefix = `/projects/${projectSlug}/generated/`;
    return Array.from(assets.values()).filter(
      (asset) => asset.path.startsWith(generatedPrefix)
    );
  }, [assets]);

  const assetTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image size={12} />;
      case 'video': return <Film size={12} />;
      case 'audio': return <Music size={12} />;
      case 'text':
      case 'prompt': return <FileText size={12} />;
      default: return <File size={12} />;
    }
  };

  const librarySyncBadgeClass =
    cloudSyncStatus.state === 'synced'
      ? styles.librarySyncStatusConnected
      : cloudSyncStatus.state === 'offline'
        ? styles.librarySyncStatusOffline
        : styles.librarySyncStatusIdle;

  return (
    <div className={styles.container}>
      {/* Filters live in the home bar. This row stayed as a second, conflicting set. */}
      {false && <div className={styles.filters}>
        <button
          className={`${styles.filterButton} ${showFavoritesOnly ? styles.filterActive : ''}`}
          onClick={toggleShowFavoritesOnly}
        >
          <Star size={14} />
          Favorites
        </button>
        
        {allTags.slice(0, 5).map((tag) => (
          <button
            key={tag}
            className={`${styles.filterButton} ${filterTags.includes(tag) ? styles.filterActive : ''}`}
            onClick={() => {
              if (filterTags.includes(tag)) {
                setFilterTags(filterTags.filter((t) => t !== tag));
              } else {
                setFilterTags([...filterTags, tag]);
              }
            }}
          >
            {tag}
          </button>
        ))}
        <label className={styles.filterSelectLabel}>
          <ArrowUpDown size={14} />
          Sort
          <select
            className={styles.filterSelect}
            value={`${sortBy}:${sortOrder}`}
            onChange={(event) => {
              const [nextSortBy, nextSortOrder] = event.target.value.split(':') as [
                'name' | 'modifiedAt' | 'createdAt',
                'asc' | 'desc',
              ];
              setSortBy(nextSortBy);
              setSortOrder(nextSortOrder);
            }}
          >
            <option value="modifiedAt:desc">Last modified (newest)</option>
            <option value="modifiedAt:asc">Last modified (oldest)</option>
            <option value="createdAt:desc">Created (newest)</option>
            <option value="createdAt:asc">Created (oldest)</option>
            <option value="name:asc">Name (A-Z)</option>
            <option value="name:desc">Name (Z-A)</option>
          </select>
        </label>
        <label className={styles.filterSelectLabel}>
          Min assets
          <input
            type="number"
            className={styles.filterNumberInput}
            min={0}
            value={minimumAssets}
            onChange={(event) => setMinimumAssets(Math.max(0, Number(event.target.value) || 0))}
          />
        </label>
      </div>}

      {/* Inventory count lives in the explorer. This row counted a different path and read as zero. */}
      {false && <div className={styles.librarySyncRow}>
        <HardDrive size={11} />
        <span className={styles.librarySyncLabel}>
          Library · <strong>{libraryAssets.length}</strong> assets
          {latestLibraryUpdateAt ? ` · updated ${formatDate(latestLibraryUpdateAt)}` : ''}
        </span>
        <span className={`${styles.librarySyncBadge} ${librarySyncBadgeClass}`}>
          <Cloud size={10} />
          {cloudSyncStatus.state === 'synced' ? 'Synced'
            : cloudSyncStatus.state === 'offline' ? 'Offline'
            : cloudSyncStatus.state === 'unauthenticated' ? 'Local only'
            : '…'}
        </span>
        <button
          type="button"
          className={styles.librarySyncRefresh}
          title={cloudSyncStatus.detail}
          onClick={() => {
            setCloudSyncStatus({ state: 'checking', detail: 'Re-checking…' });
            void refreshCloudSyncStatus();
          }}
        >
          <RefreshCcw size={10} />
        </button>
      </div>}

      {/* Projects Grid — the bar owns the single New Project control. */}
      {!isLoadingProjects && projects.length > 0 && (
        <div className={styles.folderLabel}>
          <FolderOpen size={13} />
          <span>/projects/</span>
        </div>
      )}
      <div className={styles.grid}>

        {/* Skeleton placeholders during initial load */}
        {isLoadingProjects && Array.from({ length: 4 }).map((_, i) => (
          <SkeletonProjectCard key={`skel-${i}`} />
        ))}

        {/* Project Cards */}
        {!isLoadingProjects && projects.map((project) => {
          const isAssetsOpen = assetDrawerOpen === project.id;
          const projectAssets = getProjectAssets(project.name);
          const totalBytes = projectAssets.reduce((sum, asset) => sum + measuredBytes(asset), 0);
          const chips = formatChips(project, projectAssets);

          const isDragSource = dragProjectId === project.id;
          const isDropTarget = dropTargetId === project.id;
          const parentName = parentMap.get(project.id);
          const childCount = ((project as any).childIds?.length) || 0;

          return (
            <div
              key={project.id}
              role="button"
              tabIndex={0}
              aria-label={`Open project: ${project.name}`}
              className={`${styles.projectCard} ${isDragSource ? styles.dragging : ''} ${isDropTarget ? styles.dropTarget : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, project.id)}
              onDragOver={(e) => handleDragOver(e, project.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, project.id)}
              onDragEnd={handleDragEnd}
              onClick={() => onOpenProject(project.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenProject(project.id); } }}
              onMouseLeave={(e) => {
                if (menuOpen !== project.id) return;
                const next = e.relatedTarget;
                if (next instanceof Node && e.currentTarget.contains(next)) return;
                setMenuOpen(null);
                setInfoOpen(null);
              }}
            >
              {/* Full-bleed thumbnail */}
              <div className={styles.thumbnail}>
                {project.thumbnail ? (
                  <img src={project.thumbnail} alt={project.name} />
                ) : (
                  <div className={styles.placeholderThumb}>
                    <FolderOpen size={32} />
                  </div>
                )}
              </div>

              {/* Top toolbar — left & right groups */}
              <div className={`${styles.cardToolbar} ${menuOpen === project.id ? styles.cardToolbarOpen : ''}`}>
                <div className={styles.toolbarLeft}>
                  <button
                    className={`${styles.toolbarBtn} ${styles.toolbarBtnFav}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(project.id);
                    }}
                  >
                    {project.isFavorite ? (
                      <Star size={14} fill="var(--accent-tertiary)" />
                    ) : (
                      <StarOff size={14} />
                    )}
                  </button>
                </div>

                <div className={styles.toolbarRight}>
                  <button
                    className={styles.toolbarBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setInfoOpen(null);
                      setMenuOpen(menuOpen === project.id ? null : project.id);
                    }}
                  >
                    <MoreVertical size={14} />
                  </button>

                  {menuOpen === project.id && (
                    <div className={styles.menu} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                      <button
                        className={styles.menuInfoToggle}
                        onClick={(e) => {
                          e.stopPropagation();
                          setInfoOpen(infoOpen === project.id ? null : project.id);
                        }}
                      >
                        <Info size={14} />
                        Info
                        <ChevronDown size={12} className={`${styles.assetButtonChevron} ${infoOpen === project.id ? styles.assetButtonChevronOpen : ''}`} />
                      </button>
                      {infoOpen === project.id && (
                        <div className={styles.menuInfoBody}>
                          <div><span>Created</span><b>{formatStamp(project.createdAt)}</b></div>
                          <div><span>Updated</span><b>{formatStamp(project.modifiedAt)}</b></div>
                          <div><span>Creator</span><b>@{project.createdBy || creatorHandle}</b></div>
                          <div><span>Hardware</span><b>{project.createdOn || hardwareLabel(deviceInfo)}</b></div>
                        </div>
                      )}
                      <div className={styles.menuDivider} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditProject(project);
                        }}
                      >
                        <Edit size={14} />
                        Edit
                      </button>
                      <button onClick={() => handleDuplicate(project.id)}>
                        <Copy size={14} />
                        Duplicate
                      </button>
                      <div className={styles.menuDivider} />
                      <button
                        className={styles.menuDanger}
                        onClick={() => handleDelete(project.id)}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Info overlay at the bottom */}
              <div className={`${styles.info} ${isAssetsOpen ? styles.infoExpanded : ''}`}>
                <h3 className={styles.name}>
                  {project.name}
                  <span className={styles.dragHandle} title="Drag to set parent project">
                    <GripVertical size={10} />
                  </span>
                </h3>
                {parentName && (
                  <div className={styles.hierarchyBadge}>
                    <GitBranch size={9} /> Child of <strong>{parentName}</strong>
                  </div>
                )}
                {childCount > 0 && (
                  <div className={styles.hierarchyBadge} style={{ background: 'rgba(0,212,170,0.06)', borderColor: 'rgba(0,212,170,0.2)' }}>
                    <GitBranch size={9} /> Parent of {childCount} project{childCount > 1 ? 's' : ''}
                  </div>
                )}

                <div className={styles.meta}>
                  <span className={styles.metaItem} title="Total size of this project's assets">
                    <HardDrive size={12} />
                    {projectAssets.length === 0 ? '0 B' : totalBytes > 0 ? formatBytes(totalBytes) : '…'}
                  </span>
                  <button
                    className={`${styles.assetButton} ${isAssetsOpen ? styles.assetButtonActive : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setAssetDrawerOpen(isAssetsOpen ? null : project.id);
                    }}
                  >
                    <Layers size={12} />
                    {projectAssets.length} asset{projectAssets.length !== 1 ? 's' : ''}
                    <ChevronDown
                      size={10}
                      className={`${styles.assetButtonChevron} ${isAssetsOpen ? styles.assetButtonChevronOpen : ''}`}
                    />
                  </button>
                </div>

                {/* One indicator: the count opens the type breakdown and the files. */}
                {isAssetsOpen && (
                  <div className={styles.assetListExpanded} onClick={(e) => e.stopPropagation()}>
                    {projectAssets.length === 0 ? (
                      <div className={styles.assetListEmpty}>No assets yet</div>
                    ) : (
                      <>
                        <div className={styles.mediaBadges}>
                          {(['image', 'video', 'audio', 'text', 'prompt', 'model_3d'] as const).map((type) => {
                            const count = projectAssets.filter((asset) => asset.type === type || (type === 'text' && asset.type === 'prompt')).length;
                            if (type === 'prompt') return null;
                            if (count === 0) return null;
                            return (
                              <span key={type} className={styles.mediaBadge} data-type={type === 'model_3d' ? 'folder' : type}>
                                {assetTypeIcon(type)} {count}
                              </span>
                            );
                          })}
                        </div>
                        {projectAssets.map((asset) => (
                          <div key={asset.id} className={styles.assetListItem}>
                            {asset.thumbnail ? (
                              <img src={asset.thumbnail} alt="" className={styles.assetListThumb} />
                            ) : (
                              <span className={styles.assetListIcon}>{assetTypeIcon(asset.type)}</span>
                            )}
                            <span className={styles.assetListName}>{asset.name}</span>
                            <span className={styles.assetListType} data-type={asset.type}>{asset.type}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {chips.length > 0 && (
                  <div className={styles.tags}>
                    {chips.map((chip) => (
                      <span key={chip.id} className={styles.tag} data-tone={chip.tone}>{chip.label}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!isLoadingProjects && projects.length === 0 && (
        <EmptyState
          icon={<FolderOpen size={28} />}
          title={externalFilters?.platform || externalFilters?.source
            ? 'No matching projects'
            : 'No projects yet'}
          body={externalFilters?.platform || externalFilters?.source
            ? 'Try removing the active filters to see all projects.'
            : 'Create your first project and start generating.'}
          action={undefined}
          className={styles.emptyState}
        />
      )}

      {showCreateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editingProject ? 'Edit Project' : 'Create New Project'}</h3>
              <button
                className={styles.modalClose}
                onClick={() => setShowCreateModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.formGroup}>
                <span>Project name</span>
                <input
                  type="text"
                  placeholder={getNextDefaultName()}
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className={styles.input}
                />
              </label>

              {editingProject && (
                <div className={styles.formGroup}>
                  <span>Cover</span>
                  {(() => {
                    const record = useProjectsStore.getState().getProject(editingProject);
                    const covers = record ? getProjectAssets(record.name).filter((asset) => asset.type === 'image' && asset.thumbnail) : [];
                    if (covers.length === 0) {
                      return <div className={styles.helperText}>No images in this project yet.</div>;
                    }
                    return (
                      <div className={styles.coverGrid}>
                        {covers.map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            className={`${styles.coverOption} ${draftThumbnail === asset.thumbnail ? styles.coverOptionOn : ''}`}
                            onClick={() => setDraftThumbnail(asset.thumbnail)}
                            title={asset.name}
                          >
                            <img src={asset.thumbnail} alt="" />
                            {draftThumbnail === asset.thumbnail && <Check size={12} />}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className={styles.formGroup}>
                <span>Format</span>
                <div className={styles.choiceGrid}>
                  {FORMAT_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`${styles.choice} ${formatIdOf(newProjectType, newProjectAspectRatio) === option.id ? styles.choiceOn : ''}`}
                      data-tone={option.tone}
                      onClick={() => { setNewProjectType(option.type); setNewProjectAspectRatio(option.aspect); }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.formGroup}>
                <span>Frame</span>
                <div className={styles.choiceGrid}>
                  {ASPECT_OPTIONS.map((aspect) => (
                    <button
                      key={aspect}
                      type="button"
                      className={`${styles.choice} ${newProjectAspectRatio === aspect ? styles.choiceOn : ''}`}
                      data-tone={aspect === '9:16' ? 'video' : 'image'}
                      onClick={() => setNewProjectAspectRatio(aspect)}
                    >
                      {aspect}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.formGroup}>
                <span>Platforms</span>
                <div className={styles.choiceGrid}>
                  {PLATFORM_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`${styles.choice} ${draftPlatforms.includes(option.id) ? styles.choiceOn : ''}`}
                      data-tone={option.tone}
                      onClick={() => setDraftPlatforms(toggleValue(draftPlatforms, option.id))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.formGroup}>
                <span>Locations</span>
                <div className={styles.choiceGrid}>
                  {LOCATION_OPTIONS.map((location) => (
                    <button
                      key={location}
                      type="button"
                      className={`${styles.choice} ${draftLocations.includes(location) ? styles.choiceOn : ''}`}
                      data-tone="folder"
                      onClick={() => setDraftLocations(toggleValue(draftLocations, location))}
                    >
                      {location}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.formGroup}>
                <span>Style</span>
                <div className={styles.choiceGrid}>
                  {STYLE_OPTIONS.map((style) => (
                    <button
                      key={style}
                      type="button"
                      className={`${styles.choice} ${draftStyles.includes(style) ? styles.choiceOn : ''}`}
                      data-tone="text"
                      onClick={() => setDraftStyles(toggleValue(draftStyles, style))}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.formGroup}>
                <span>Genre</span>
                <div className={styles.choiceGrid}>
                  {GENRE_OPTIONS.map((genre) => (
                    <button
                      key={genre}
                      type="button"
                      className={`${styles.choice} ${draftGenres.includes(genre) ? styles.choiceOn : ''}`}
                      data-tone="text"
                      onClick={() => setDraftGenres(toggleValue(draftGenres, genre))}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.formGroup}>
                <span>Length</span>
                <div className={styles.choiceGrid}>
                  {LENGTH_OPTIONS.map((length) => (
                    <button
                      key={length}
                      type="button"
                      className={`${styles.choice} ${newProjectLength === length ? styles.choiceOn : ''}`}
                      data-tone="text"
                      onClick={() => setNewProjectLength(newProjectLength === length ? '' : length)}
                    >
                      {length}
                    </button>
                  ))}
                </div>
              </div>
              <label className={styles.formGroup}>
                <span>Characters</span>
                <input
                  type="text"
                  placeholder="Hero, villain, narrator"
                  value={newProjectCharacters}
                  onChange={(e) => setNewProjectCharacters(e.target.value)}
                  className={styles.input}
                />
              </label>
              <div className={styles.formGroup}>
                <span>Other details</span>
                {draftTags.length > 0 && (
                  <div className={styles.choiceGrid}>
                    {draftTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={`${styles.choice} ${styles.choiceOn}`}
                        data-tone="folder"
                        onClick={() => setDraftTags(draftTags.filter((item) => item !== tag))}
                        title="Remove"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Add a word, then Enter"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const value = tagDraft.trim();
                    if (!value || draftTags.includes(value) || INTERNAL_TAGS.has(value)) return;
                    setDraftTags([...draftTags, value]);
                    setTagDraft('');
                  }}
                  className={styles.input}
                />
              </div>
              <div className={styles.helperText}>
                These choices show on the card. An empty name becomes {getNextDefaultName()}.
              </div>
            </div>
            <div className={styles.modalActions}>
              <Button variant="primary" onClick={handleSaveProject}>
                {editingProject ? 'Save Changes' : 'Create Project'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectsGrid;
