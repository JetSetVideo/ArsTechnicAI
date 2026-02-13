/**
 * ProjectsGrid Component
 * 
 * Grid display of user projects with thumbnails, search, and filters.
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Star, 
  StarOff, 
  MoreVertical, 
  Trash2, 
  Copy, 
  FolderOpen,
  Calendar,
  Layers
} from 'lucide-react';
import { useProjectsStore } from '../../stores';
import { useUserStore } from '../../stores/userStore';
import { useFileStore } from '../../stores/fileStore';
import { slugifyProjectName } from '../../utils/project';
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
  const { 
    getSortedProjects, 
    addProject, 
    toggleFavorite, 
    deleteProject, 
    duplicateProject,
    getAllTags,
    getNextDefaultName,
    filterTags,
    setFilterTags,
    showFavoritesOnly,
    toggleShowFavoritesOnly,
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
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectTags, setNewProjectTags] = useState('');
  const libraryAssets = useMemo(
    () => Array.from(assets.values()).filter((asset) => asset.path.startsWith('/library/')),
    [assets]
  );
  
  const sortedProjects = getSortedProjects();
  const projects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedProjects;
    return sortedProjects.filter((project) =>
      project.name.toLowerCase().includes(query) ||
      project.tags.some((tag) => tag.toLowerCase().includes(query)) ||
      (project.description || '').toLowerCase().includes(query)
    );
  }, [sortedProjects, searchQuery]);
  const allTags = getAllTags();

  const handleNewProject = () => {
    setNewProjectName('');
    setNewProjectTags('');
    setShowCreateModal(true);
  };

  const handleCreateProject = () => {
    const trimmedName = newProjectName.trim();
    const tags = newProjectTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const projectName = trimmedName || getNextDefaultName();
    const newProject = addProject({
      name: projectName,
      tags,
    });

    setShowCreateModal(false);
    onOpenProject(newProject.id);
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
      </div>

      {/* Shared library summary */}
      <div className={styles.librarySummary}>
        <span className={styles.libraryTitle}>Shared Library</span>
        <span className={styles.libraryMeta}>
          {libraryAssets.length} asset{libraryAssets.length !== 1 ? 's' : ''} reusable across projects
        </span>
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
              <h3 className={styles.name}>{project.name}</h3>
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
              <h3>Create New Project</h3>
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
                <span>Tags (comma separated)</span>
                <input
                  type="text"
                  placeholder="branding, video, launch"
                  value={newProjectTags}
                  onChange={(e) => setNewProjectTags(e.target.value)}
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
              <Button variant="primary" onClick={handleCreateProject}>
                Create Project
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectsGrid;
