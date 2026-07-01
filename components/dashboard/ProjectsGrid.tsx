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
  Calendar,
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
  ImageIcon,
  Check,
  Sparkles,
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
import type { FileNode } from '../../types';

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

  // Sync project cards with real project folders/assets from file tree.
  useEffect(() => {
    const projectsRoot = findNodeByPath(rootNodes, '/projects');
    const projectFolders = (projectsRoot?.children || []).filter((n) => n.type === 'folder');
    if (projectFolders.length === 0) return;

    useProjectsStore.setState((state) => {
      const now = Date.now();
      const nextProjects = [...state.projects];

      for (const projectFolder of projectFolders) {
        const projectSlug = projectFolder.path.split('/').pop() || '';
        const generatedPrefix = `${projectFolder.path}/generated/`;
        const projectAssets = Array.from(assets.values()).filter(
          (asset) => asset.path.startsWith(generatedPrefix)
        );
        const latestImage = projectAssets
          .filter((asset) => asset.type === 'image' && asset.thumbnail)
          .sort((a, b) => b.modifiedAt - a.modifiedAt)[0];

        const existing = nextProjects.find((p) => slugifyProjectName(p.name) === projectSlug);
        if (existing) {
          existing.assetCount = projectAssets.length;
          existing.modifiedAt = projectAssets.length > 0
            ? Math.max(existing.modifiedAt, ...projectAssets.map((a) => a.modifiedAt))
            : existing.modifiedAt;
          if (!existing.thumbnail && latestImage?.thumbnail) {
            existing.thumbnail = latestImage.thumbnail;
          }
          continue;
        }

        nextProjects.unshift({
          id: `proj-${projectSlug}`,
          name: projectFolder.name,
          createdAt: now,
          modifiedAt: projectAssets.length > 0 ? Math.max(...projectAssets.map((a) => a.modifiedAt)) : now,
          assetCount: projectAssets.length,
          tags: [],
          isFavorite: false,
          thumbnail: latestImage?.thumbnail,
        });
      }

      return { projects: nextProjects };
    });
  }, [rootNodes, assets]);

  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectTags, setNewProjectTags] = useState('');
  const [newProjectLength, setNewProjectLength] = useState('');
  const [newProjectStyle, setNewProjectStyle] = useState('');
  const [newProjectGenre, setNewProjectGenre] = useState('');
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
      filtered = filtered.filter((p) => (p as any).type === externalFilters.platform);
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

  const handleNewProject = () => {
    setEditingProject(null);
    setNewProjectName('');
    setNewProjectTags('');
    setNewProjectLength('');
    setNewProjectStyle('');
    setNewProjectGenre('');
    setNewProjectCharacters('');
    setNewProjectType('generic');
    setNewProjectAspectRatio('16:9');
    setShowCreateModal(true);
  };

  const handleEditProject = (project: any) => {
    setEditingProject(project.id);
    setNewProjectName(project.name);
    setNewProjectTags(project.tags.join(', '));
    setNewProjectLength(project.length || '');
    setNewProjectStyle(project.style || '');
    setNewProjectGenre(project.genre || '');
    setNewProjectCharacters(project.characters || '');
    setNewProjectType(project.type || 'generic');
    setNewProjectAspectRatio(project.aspectRatio || '16:9');
    setShowCreateModal(true);
  };

  const handleSaveProject = () => {
    const trimmedName = newProjectName.trim();
    const tags = newProjectTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const projectData = {
      name: trimmedName || getNextDefaultName(),
      tags,
      length: newProjectLength,
      style: newProjectStyle,
      genre: newProjectGenre,
      characters: newProjectCharacters,
      type: newProjectType,
      aspectRatio: newProjectAspectRatio,
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

  const [assetDrawerOpen, setAssetDrawerOpen] = useState<string | null>(null);
  const [coverPickerOpen, setCoverPickerOpen] = useState<string | null>(null);
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
      {/* Filters */}
      <div className={styles.filters}>
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
      </div>

      {/* Library sync status — compact one-liner */}
      <div className={styles.librarySyncRow}>
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
      </div>

      {/* Projects Grid */}
      <div className={styles.grid}>
        {/* New Project Card */}
        <button className={styles.newProjectCard} onClick={handleNewProject}>
          <Plus size={32} />
          <span>New Project</span>
        </button>

        {/* Skeleton placeholders during initial load */}
        {isLoadingProjects && Array.from({ length: 4 }).map((_, i) => (
          <SkeletonProjectCard key={`skel-${i}`} />
        ))}

        {/* Project Cards */}
        {!isLoadingProjects && projects.map((project) => {
          const isAssetsOpen = assetDrawerOpen === project.id;
          const projectAssets = getProjectAssets(project.name);
          const imageAssets = projectAssets.filter((a) => a.type === 'image' && a.thumbnail);

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
              <div className={styles.cardToolbar}>
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
                  <button
                    className={styles.toolbarBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditProject(project);
                    }}
                  >
                    <Edit size={14} />
                  </button>
                </div>

                <div className={styles.toolbarRight}>
                  <button
                    className={styles.toolbarBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCoverPickerOpen(null);
                      setMenuOpen(menuOpen === project.id ? null : project.id);
                    }}
                  >
                    <MoreVertical size={14} />
                  </button>

                  {menuOpen === project.id && (
                    <div className={styles.menu} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleDuplicate(project.id)}>
                        <Copy size={14} />
                        Duplicate
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCoverPickerOpen(coverPickerOpen === project.id ? null : project.id);
                        }}
                      >
                        <ImageIcon size={14} />
                        Set Cover Image
                      </button>

                      {coverPickerOpen === project.id && (
                        <>
                          <div className={styles.menuDivider} />
                          <div className={styles.coverPickerLabel}>Choose cover</div>
                          {imageAssets.length === 0 ? (
                            <button disabled style={{ opacity: 0.4, cursor: 'default' }}>
                              No images available
                            </button>
                          ) : (
                            imageAssets.map((asset) => (
                              <button
                                key={asset.id}
                                className={`${styles.coverPickerItem} ${asset.thumbnail === project.thumbnail ? styles.coverPickerActive : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateProject(project.id, { thumbnail: asset.thumbnail });
                                  setCoverPickerOpen(null);
                                  setMenuOpen(null);
                                }}
                              >
                                <img src={asset.thumbnail} alt="" className={styles.coverPickerThumb} />
                                <span className={styles.coverPickerName}>{asset.name}</span>
                                {asset.thumbnail === project.thumbnail && <Check size={12} />}
                              </button>
                            ))
                          )}
                        </>
                      )}

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
                  <span className={styles.pathPrefix}>/projects/</span>
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

                {/* Media type badge counts */}
                {(() => {
                  const typeCounts: Record<string, number> = {};
                  projectAssets.forEach(a => { typeCounts[a.type] = (typeCounts[a.type] || 0) + 1; });
                  const sourceCounts: Record<string, number> = {};
                  projectAssets.forEach(a => { 
                    const src = a.metadata?.source || 'imported'; 
                    sourceCounts[src] = (sourceCounts[src] || 0) + 1; 
                  });
                  return (
                    <>
                      <div className={styles.mediaBadges}>
                        {typeCounts['image'] ? <span className={styles.mediaBadge} data-type="image" title="Images"><Image size={10} /> {typeCounts['image']}</span> : null}
                        {typeCounts['video'] ? <span className={styles.mediaBadge} data-type="video" title="Videos"><Film size={10} /> {typeCounts['video']}</span> : null}
                        {typeCounts['audio'] ? <span className={styles.mediaBadge} data-type="audio" title="Audio"><Music size={10} /> {typeCounts['audio']}</span> : null}
                        {typeCounts['text'] || typeCounts['prompt'] ? <span className={styles.mediaBadge} data-type="text" title="Text"><FileText size={10} /> {(typeCounts['text']||0) + (typeCounts['prompt']||0)}</span> : null}
                        {(sourceCounts['generated'] || sourceCounts['imported'] || sourceCounts['remixed']) ? (
                          <span 
                            className={styles.mediaBadge} 
                            data-type="source" 
                            title={`AI: ${sourceCounts['generated']||0} | Import: ${sourceCounts['imported']||0} | Remix: ${sourceCounts['remixed']||0}`}
                          >
                            <Sparkles size={10} /> {sourceCounts['generated']||0}/{sourceCounts['imported']||0}/{sourceCounts['remixed']||0}
                          </span>
                        ) : null}
                      </div>
                    </>
                  );
                })()}

                {(project.genre || project.style || project.length || project.type) && (
                  <div className={styles.details}>
                    {project.type && project.type !== 'generic' && (
                      <span className={styles.detailItem} style={{ color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}>
                        {project.type}
                      </span>
                    )}
                    {project.aspectRatio && project.aspectRatio !== '16:9' && (
                      <span className={styles.detailItem}>{project.aspectRatio}</span>
                    )}
                    {project.genre && <span className={styles.detailItem}>{project.genre}</span>}
                    {project.style && <span className={styles.detailItem}>{project.style}</span>}
                    {project.length && <span className={styles.detailItem}>{project.length}</span>}
                  </div>
                )}

                <div className={styles.meta}>
                  <span className={styles.metaItem}>
                    <Calendar size={12} />
                    {formatDate(project.modifiedAt)}
                  </span>
                  {/* Status indicator */}
                  <span
                    className={`${styles.statusDot} ${project.assetCount > 0 ? styles.statusActive : styles.statusEmpty}`}
                    title={project.assetCount > 0 ? 'Has assets' : 'No assets yet'}
                  />
                  <button
                    className={`${styles.assetButton} ${isAssetsOpen ? styles.assetButtonActive : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setAssetDrawerOpen(isAssetsOpen ? null : project.id);
                    }}
                  >
                    <Layers size={12} />
                    {project.assetCount} asset{project.assetCount !== 1 ? 's' : ''}
                    <ChevronDown
                      size={10}
                      className={`${styles.assetButtonChevron} ${isAssetsOpen ? styles.assetButtonChevronOpen : ''}`}
                    />
                  </button>
                </div>

                {/* Expanded asset list — inline, full width */}
                {isAssetsOpen && (
                  <div className={styles.assetListExpanded} onClick={(e) => e.stopPropagation()}>
                    {projectAssets.length === 0 ? (
                      <div className={styles.assetListEmpty}>No assets yet</div>
                    ) : (
                      projectAssets.map((asset) => (
                        <div key={asset.id} className={styles.assetListItem}>
                          {asset.thumbnail ? (
                            <img src={asset.thumbnail} alt="" className={styles.assetListThumb} />
                          ) : (
                            <span className={styles.assetListIcon}>{assetTypeIcon(asset.type)}</span>
                          )}
                          <span className={styles.assetListName}>{asset.name}</span>
                          <span className={styles.assetListType}>{asset.type}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {project.tags.length > 0 && (
                  <div className={styles.tags}>
                    {project.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className={styles.tag}>{tag}</span>
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
          action={!externalFilters?.platform && !externalFilters?.source
            ? { label: 'New Project', onClick: handleNewProject, icon: <Plus size={13} /> }
            : undefined}
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
              <label className={styles.formGroup}>
                <span>Project Type</span>
                <select
                  value={newProjectType}
                  onChange={(e) => setNewProjectType(e.target.value)}
                  className={styles.input}
                >
                  <option value="generic">Generic Project</option>
                  <option value="video">Video (Linear)</option>
                  <option value="short">Short (Vertical)</option>
                  <option value="feature">Feature Film</option>
                  <option value="script">Script/Screenplay</option>
                  <option value="comic">Comic Book</option>
                  <option value="storyboard">Storyboard</option>
                  <option value="audio">Audio Drama</option>
                </select>
              </label>
              <label className={styles.formGroup}>
                <span>Aspect Ratio</span>
                <select
                  value={newProjectAspectRatio}
                  onChange={(e) => setNewProjectAspectRatio(e.target.value)}
                  className={styles.input}
                >
                  <option value="16:9">16:9 (Widescreen)</option>
                  <option value="9:16">9:16 (Vertical)</option>
                  <option value="1:1">1:1 (Square)</option>
                  <option value="2.35:1">2.35:1 (Cinemascope)</option>
                  <option value="4:3">4:3 (TV)</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label className={styles.formGroup}>
                <span>Tags (comma separated)</span>
                <input
                  type="text"
                  placeholder="branding, video, launch"
                  value={newProjectTags}
                  onChange={(e) => setNewProjectTags(e.target.value)}
                  className={styles.input}
                />
              </label>
              <label className={styles.formGroup}>
                <span>Length</span>
                <input
                  type="text"
                  placeholder="e.g. 120 mins"
                  value={newProjectLength}
                  onChange={(e) => setNewProjectLength(e.target.value)}
                  className={styles.input}
                />
              </label>
              <label className={styles.formGroup}>
                <span>Style</span>
                <input
                  type="text"
                  placeholder="e.g. Noir, Minimalist"
                  value={newProjectStyle}
                  onChange={(e) => setNewProjectStyle(e.target.value)}
                  className={styles.input}
                />
              </label>
              <label className={styles.formGroup}>
                <span>Genre</span>
                <input
                  type="text"
                  placeholder="e.g. Sci-Fi, Drama"
                  value={newProjectGenre}
                  onChange={(e) => setNewProjectGenre(e.target.value)}
                  className={styles.input}
                />
              </label>
              <label className={styles.formGroup}>
                <span>Characters</span>
                <input
                  type="text"
                  placeholder="e.g. Hero, Villain"
                  value={newProjectCharacters}
                  onChange={(e) => setNewProjectCharacters(e.target.value)}
                  className={styles.input}
                />
              </label>
              <div className={styles.helperText}>
                If you leave the name empty, it will be created as {getNextDefaultName()}.
              </div>
            </div>
            <div className={styles.modalActions}>
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
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
