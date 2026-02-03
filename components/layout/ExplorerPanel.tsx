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
  Plus,
  Upload,
  MoreHorizontal,
  Trash2,
  Edit,
  Copy,
} from 'lucide-react';
import { useFileStore, useLogStore, useCanvasStore } from '@/stores';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import styles from './ExplorerPanel.module.css';
import type { FileNode, Asset } from '@/types';

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
  isSelected: boolean;
  isExpanded: boolean;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node,
  depth,
  onSelect,
  onToggle,
  onDragStart,
  isSelected,
  isExpanded,
}) => {
  const hasChildren = node.type === 'folder' && node.children && node.children.length > 0;

  return (
    <div className={styles.treeItem}>
      <div
        className={`${styles.treeItemRow} ${isSelected ? styles.selected : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node)}
        draggable={node.type === 'file'}
        onDragStart={(e) => onDragStart(e, node)}
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
        <span className={styles.name}>{node.name}</span>

        {node.asset?.thumbnail && (
          <div className={styles.thumbnail}>
            <img src={node.asset.thumbnail} alt="" />
          </div>
        )}
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
  const { selectedPath, expandedPaths, selectPath, toggleExpanded } = useFileStore();
  const { addItemFromAsset } = useCanvasStore();
  const log = useLogStore((s) => s.log);

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
        e.dataTransfer.effectAllowed = 'copy';
        log('file_import', `Started dragging ${n.name}`);
      }
    },
    [log]
  );

  return (
    <FileTreeItem
      node={node}
      depth={depth}
      onSelect={handleSelect}
      onToggle={toggleExpanded}
      onDragStart={handleDragStart}
      isSelected={selectedPath === node.path}
      isExpanded={expandedPaths.has(node.path)}
    />
  );
};

export const ExplorerPanel: React.FC<ExplorerPanelProps> = ({ width }) => {
  const { rootNodes, initializeFileStructure, importFiles } = useFileStore();
  const log = useLogStore((s) => s.log);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('');

  // Initialize file structure on mount
  useEffect(() => {
    if (rootNodes.length === 0) {
      initializeFileStructure('Untitled Project');
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

  const filteredNodes = filter
    ? rootNodes.filter(
        (n) =>
          n.name.toLowerCase().includes(filter.toLowerCase()) ||
          n.children?.some((c) =>
            c.name.toLowerCase().includes(filter.toLowerCase())
          )
      )
    : rootNodes;

  return (
    <aside className={styles.explorer} style={{ width }}>
      <div className={styles.header}>
        <h2 className={styles.title}>Explorer</h2>
        <div className={styles.headerActions}>
          <Button variant="ghost" size="sm" onClick={handleImportClick} title="Import files">
            <Upload size={14} />
          </Button>
          <Button variant="ghost" size="sm" title="New folder">
            <Plus size={14} />
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
