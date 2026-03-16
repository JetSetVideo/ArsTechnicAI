/**
 * ProjectsGrid Component
 * 
 * Grid display of user projects with thumbnails, search, and filters.
 */

import { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
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
  Edit
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useProjectsStore } from '../../stores';
import { useUserStore } from '../../stores/userStore';
import { useFileStore } from '../../stores/fileStore';
import { slugifyProjectName } from '../../utils/project';
import { WORKSPACE_ROOT_PATHS } from '../../constants/workspace';
import { Button } from '../ui';
import styles from './ProjectsGrid.module.css';
import type { FileNode } from '../../types';

interface ProjectsGridProps {
  onOpenProject: (projectId: string) => void;
  searchQuery?: string;
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

export function ProjectsGrid({ onOpenProject, searchQuery = '' }: ProjectsGridProps) {
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
  
  const sortedProjects = getSortedProjects();
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const projects = useMemo(() => {
    const query = deferredSearchQuery.trim();
    const filteredBySearch = !query
      ? sortedProjects
      : sortedProjects.filter((project) => {
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
    return filteredBySearch.filter((project) =>
      project.assetCount >= minimumAssets
    );
  }, [sortedProjects, deferredSearchQuery, minimumAssets]);
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
    if (confirm('Are you sure you want to delete this project?')) {
      deleteProject(id);
    }
    setMenuOpen(null);
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

      {/* Shared library summary */}
      <div className={styles.librarySummary}>
        <div className={styles.librarySummaryMain}>
          <span className={styles.libraryTitle}>Shared Library</span>
          <span className={styles.libraryMeta}>
            <span className={styles.libraryMetaValueBold}>{libraryAssets.length}</span> <span className={styles.libraryMetaLabelNormal}>asset{libraryAssets.length !== 1 ? 's' : ''} reusable across projects</span>
          </span>
          <span className={styles.libraryMeta}>
            <HardDrive size={13} /> <span className={styles.libraryMetaLabelBold}>Local path:</span> <code className={styles.libraryMetaValueNormal}>{WORKSPACE_ROOT_PATHS.library}</code>
          </span>
          <span className={styles.libraryMeta}>
            <span className={styles.libraryMetaLabelBold}>Last local update:</span> <span className={styles.libraryMetaValueNormal}>{latestLibraryUpdateAt ? formatDate(latestLibraryUpdateAt) : 'No assets yet'}</span>
          </span>
        </div>
        <div className={styles.librarySummaryActions}>
          <span className={`${styles.librarySyncStatus} ${librarySyncBadgeClass}`}>
            <Cloud size={13} />
            {cloudSyncStatus.detail}
          </span>
          <button
            type="button"
            className={styles.filterButton}
            onClick={() => {
              setCloudSyncStatus({
                state: 'checking',
                detail: 'Re-checking backend sync status...',
              });
              void refreshCloudSyncStatus();
            }}
          >
            <RefreshCcw size={14} />
            Refresh status
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      <div className={styles.grid}>
        {/* New Project Card */}
        <button className={styles.newProjectCard} onClick={handleNewProject}>
          <Plus size={32} />
          <span>New Project</span>
        </button>

        {/* Project Cards */}
        {projects.map((project) => (
          <div 
            key={project.id} 
            className={styles.projectCard}
            onClick={() => onOpenProject(project.id)}
          >
            {/* Thumbnail */}
            <div className={styles.thumbnail}>
              {project.thumbnail ? (
                <img src={project.thumbnail} alt={project.name} />
              ) : (
                <div className={styles.placeholderThumb}>
                  <FolderOpen size={32} />
                </div>
              )}
              
              {/* Favorite Button */}
              <button
                className={styles.favoriteButton}
                style={{ right: '40px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditProject(project);
                }}
              >
                <Edit size={16} />
              </button>

              <button
                className={styles.favoriteButton}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(project.id);
                }}
              >
                {project.isFavorite ? (
                  <Star size={16} fill="var(--accent-tertiary)" />
                ) : (
                  <StarOff size={16} />
                )}
              </button>

              {/* Menu Button */}
              <button
                className={styles.menuButton}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(menuOpen === project.id ? null : project.id);
                }}
              >
                <MoreVertical size={16} />
              </button>

              {/* Dropdown Menu */}
              {menuOpen === project.id && (
                <div className={styles.menu}>
                  <button onClick={() => handleDuplicate(project.id)}>
                    <Copy size={14} />
                    Duplicate
                  </button>
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

            {/* Info */}
            <div className={styles.info}>
              <h3 className={styles.name}>
                <span className={styles.pathPrefix}>/projects/</span>
                {project.name}
              </h3>
              
              {(project.genre || project.style || project.length || project.type) && (
                <div className={styles.details}>
                  {project.type && project.type !== 'generic' && <span className={styles.detailItem} style={{ color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}>{project.type}</span>}
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
                <span className={styles.metaItem}>
                  <Layers size={12} />
                  {project.assetCount} assets
                </span>
              </div>
              {project.tags.length > 0 && (
                <div className={styles.tags}>
                  {project.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className={styles.tag}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && (
        <div className={styles.empty}>
          <p>No projects found</p>
          <Button variant="primary" onClick={handleNewProject}>
            Create your first project
          </Button>
        </div>
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
