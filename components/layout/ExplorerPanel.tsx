import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Folder,
  FolderOpen,
  Image,
  FileText,
  Film,
  Music,
  ChevronRight,
  ChevronDown,
  Upload,
  Trash2,
  Pencil,
  FolderPlus,
} from 'lucide-react';
import { useFileStore, useLogStore } from '@/stores';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import styles from './ExplorerPanel.module.css';
import type { FileNode } from '@/types';
import { WORKSPACE_DEFAULTS, WORKSPACE_PROTECTED_PATHS, WORKSPACE_ROOT_PATHS } from '@/constants/workspace';

interface ExplorerPanelProps {
  width: number;
  onResize?: (width: number) => void;
}

const getFileIcon = (node: FileNode) => {
  if (node.type === 'folder') {
    return node.expanded ? <FolderOpen size={16} /> : <Folder size={16} />;
  }

  const asset = node.asset;
  if (!asset) return <FileText size={16} />;

  switch (asset.type) {
    case 'image':
      return <Image size={16} />;
    case 'video':
      return <Film size={16} />;
    case 'audio':
      return <Music size={16} />;
    default:
      return <FileText size={16} />;
  }
};

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  onSelect: (node: FileNode) => void;
  onToggle: (path: string) => void;
  onDragStart: (e: React.DragEvent, node: FileNode) => void;
  onDropNode: (sourcePath: string, targetPath: string) => void;
  onStartRename: (node: FileNode) => void;
  onDeleteNode: (node: FileNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  editingPath: string | null;
  editingName: string;
  onEditingNameChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  isSelected: boolean;
  isExpanded: boolean;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node,
  depth,
  onSelect,
  onToggle,
  onDragStart,
  onDropNode,
  onStartRename,
  onDeleteNode,
  onContextMenu,
  editingPath,
  editingName,
  onEditingNameChange,
  onRenameSubmit,
  onRenameCancel,
  isSelected,
  isExpanded,
}) => {
  return (
    <div className={styles.treeItem}>
      <div
        className={`${styles.treeItemRow} ${isSelected ? styles.selected : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node)}
        onContextMenu={(e) => onContextMenu(e, node)}
        draggable={!(node.type === 'folder' && ['/', '/projects', '/imports', '/library', '/prompts'].includes(node.path))}
        onDragStart={(e) => onDragStart(e, node)}
        onDragOver={(e) => {
          if (node.type === 'folder') e.preventDefault();
        }}
        onDrop={(e) => {
          if (node.type !== 'folder') return;
          const sourcePath = e.dataTransfer.getData('application/x-file-node-path');
          if (!sourcePath) return;
          e.preventDefault();
          onDropNode(sourcePath, node.path);
        }}
        role="treeitem"
        aria-selected={isSelected}
      >
        {node.type === 'folder' ? (
          <button
            className={styles.expandButton}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.path);
            }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className={styles.expandPlaceholder} />
        )}

        <span className={styles.icon}>{getFileIcon({ ...node, expanded: isExpanded })}</span>
        {editingPath === node.path ? (
          <input
            className={styles.renameInput}
            value={editingName}
            autoFocus
            onChange={(e) => onEditingNameChange(e.target.value)}
            onBlur={onRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameSubmit();
              if (e.key === 'Escape') onRenameCancel();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={styles.name}>{node.name}</span>
        )}

        {node.asset?.thumbnail && (
          <div className={styles.thumbnail}>
            <img src={node.asset.thumbnail} alt="" />
          </div>
        )}

        <div className={styles.rowActions}>
          <button
            type="button"
            className={styles.rowActionButton}
            title="Rename"
            onClick={(e) => {
              e.stopPropagation();
              onStartRename(node);
            }}
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            className={styles.rowActionButton}
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteNode(node);
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {node.type === 'folder' && isExpanded && node.children && (
        <div className={styles.children}>
          {node.children.map((child) => (
            <FileTreeItemWrapper key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

// Wrapper to connect to store
const FileTreeItemWrapper: React.FC<{ node: FileNode; depth: number }> = ({
  node,
  depth,
}) => {
  const {
    selectedPath,
    expandedPaths,
    selectPath,
    toggleExpanded,
    moveNode,
    renameNode,
    deleteNode,
  } = useFileStore();
  const log = useLogStore((s) => s.log);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleSelect = useCallback(
    (n: FileNode) => {
      selectPath(n.path);
      if (n.type === 'folder') {
        toggleExpanded(n.path);
      }
    },
    [selectPath, toggleExpanded]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, n: FileNode) => {
      if (n.asset) {
        e.dataTransfer.setData('application/json', JSON.stringify(n.asset));
        e.dataTransfer.setData('application/x-file-node-path', n.path);
        e.dataTransfer.effectAllowed = 'copy';
        log('file_import', `Started dragging ${n.name}`);
      }
    },
    [log]
  );

  const handleDropNode = useCallback(
    (sourcePath: string, targetPath: string) => {
      if (sourcePath === targetPath) return;
      const moved = moveNode(sourcePath, targetPath);
      if (moved) {
        log('folder_open', `Moved ${sourcePath} to ${targetPath}`);
      }
    },
    [moveNode, log]
  );

  const handleStartRename = useCallback((n: FileNode) => {
    setEditingPath(n.path);
    setEditingName(n.name);
  }, []);

  const handleRenameSubmit = useCallback(() => {
    if (!editingPath) return;
    const value = editingName.trim();
    if (value) {
      const renamed = renameNode(editingPath, value);
      if (renamed) log('settings_change', `Renamed item to ${value}`);
    }
    setEditingPath(null);
    setEditingName('');
  }, [editingPath, editingName, renameNode, log]);

  const handleDelete = useCallback(
    (n: FileNode) => {
      const ok = window.confirm(`Delete "${n.name}"?`);
      if (!ok) return;
      if (deleteNode(n.path)) {
        log('canvas_remove', `Deleted ${n.path}`);
      }
    },
    [deleteNode, log]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, n: FileNode) => {
      e.preventDefault();
      handleSelect(n);
    },
    [handleSelect]
  );

  return (
    <FileTreeItem
      node={node}
      depth={depth}
      onSelect={handleSelect}
      onToggle={toggleExpanded}
      onDragStart={handleDragStart}
      onDropNode={handleDropNode}
      onStartRename={handleStartRename}
      onDeleteNode={handleDelete}
      onContextMenu={handleContextMenu}
      editingPath={editingPath}
      editingName={editingName}
      onEditingNameChange={setEditingName}
      onRenameSubmit={handleRenameSubmit}
      onRenameCancel={() => {
        setEditingPath(null);
        setEditingName('');
      }}
      isSelected={selectedPath === node.path}
      isExpanded={expandedPaths.has(node.path)}
    />
  );
};

export const ExplorerPanel: React.FC<ExplorerPanelProps> = ({ width }) => {
  const {
    rootNodes,
    selectedPath,
    initializeFileStructure,
    importFiles,
    createFolder,
    findNodeByPath,
    deleteNode,
    renameNode,
  } = useFileStore();
  const log = useLogStore((s) => s.log);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('');

  // Initialize file structure on mount
  useEffect(() => {
    if (rootNodes.length === 0) {
      initializeFileStructure(WORKSPACE_DEFAULTS.projectName);
    }
  }, [rootNodes.length, initializeFileStructure]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const imported = await importFiles(files);
        log('file_import', `Imported ${imported.length} file(s)`, {
          count: imported.length,
          names: imported.map((a) => a.name),
        });
      }
      // Reset input
      e.target.value = '';
    },
    [importFiles, log]
  );

  const handleNewFolder = useCallback(() => {
    const base =
      selectedPath && findNodeByPath(selectedPath)?.type === 'folder'
        ? selectedPath
        : WORKSPACE_ROOT_PATHS.library;
    let index = 1;
    let folderName = `New Folder`;
    while (findNodeByPath(`${base}/${folderName}`)) {
      index += 1;
      folderName = `New Folder ${index}`;
    }
    const created = createFolder(base, folderName);
    if (created) {
      log('folder_create', `Created folder ${created.path}`);
    }
  }, [selectedPath, findNodeByPath, createFolder, log]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!selectedPath) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const node = findNodeByPath(selectedPath);
        if (!node) return;
        if (WORKSPACE_PROTECTED_PATHS.has(node.path)) return;
        if (deleteNode(node.path)) {
          log('canvas_remove', `Deleted ${node.path}`);
        }
      }
      if (e.key === 'F2') {
        const node = findNodeByPath(selectedPath);
        if (!node) return;
        const next = window.prompt('Rename item', node.name);
        if (!next || !next.trim()) return;
        if (renameNode(node.path, next.trim())) {
          log('settings_change', `Renamed ${node.path} to ${next.trim()}`);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPath, findNodeByPath, deleteNode, renameNode, log]);

  const filterTree = useCallback((nodes: FileNode[], query: string): FileNode[] => {
    if (!query.trim()) return nodes;
    const q = query.toLowerCase();
    return nodes
      .map((node) => {
        const childMatches = node.children ? filterTree(node.children, query) : [];
        const selfMatches = node.name.toLowerCase().includes(q);
        if (selfMatches || childMatches.length > 0) {
          return {
            ...node,
            children: node.children ? childMatches : node.children,
          };
        }
        return null;
      })
      .filter((n): n is FileNode => n !== null);
  }, []);

  const filteredNodes = filterTree(rootNodes, filter);

  return (
    <aside className={styles.explorer} style={{ width }} data-density="compact">
      <div className={styles.header}>
        <h2 className={styles.title}>Explorer</h2>
        <div className={styles.headerActions}>
          <Button variant="ghost" size="sm" onClick={handleImportClick} title="Import files">
            <Upload size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleNewFolder} title="New folder">
            <FolderPlus size={14} />
          </Button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <Input
          placeholder="Filter files..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className={styles.tree}>
        {filteredNodes.map((node) => (
          <FileTreeItemWrapper key={node.id} node={node} depth={0} />
        ))}

        {filteredNodes.length === 0 && (
          <div className={styles.empty}>
            <p>No files yet</p>
            <Button variant="secondary" size="sm" onClick={handleImportClick}>
              <Upload size={14} />
              Import Images
            </Button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />
    </aside>
  );
};
