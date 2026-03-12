import React, { useCallback, useEffect, useRef, useState, useDeferredValue } from 'react';
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
  Cloud,
  HardDrive,
  RefreshCw,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useFileStore, useLogStore, useCanvasStore } from '@/stores';
import { useAssetLibrary, DbAsset } from '@/hooks/useAssetLibrary';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import styles from './ExplorerPanel.module.css';
import type { FileNode } from '@/types';
import { WORKSPACE_DEFAULTS, WORKSPACE_PROTECTED_PATHS, WORKSPACE_ROOT_PATHS } from '@/constants/workspace';

type Tab = 'local' | 'cloud';

interface ExplorerPanelProps {
  width: number;
}

const getFileIcon = (node: FileNode) => {
  if (node.type === 'folder') return node.expanded ? <FolderOpen size={16} /> : <Folder size={16} />;
  const asset = node.asset;
  if (!asset) return <FileText size={16} />;
  switch (asset.type) {
    case 'image': return <Image size={16} />;
    case 'video': return <Film size={16} />;
    case 'audio': return <Music size={16} />;
    default: return <FileText size={16} />;
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
  node, depth, onSelect, onToggle, onDragStart, isSelected, isExpanded,
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
          <button className={styles.expandButton} onClick={(e) => { e.stopPropagation(); onToggle(node.path); }}>
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
});

const FileTreeItemWrapper: React.FC<{ node: FileNode; depth: number }> = ({ node, depth }) => {
  const { selectedPath, expandedPaths, selectPath, toggleExpanded } = useFileStore();
  const log = useLogStore((s) => s.log);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleSelect = useCallback((n: FileNode) => {
    selectPath(n.path);
    if (n.type === 'folder') toggleExpanded(n.path);
  }, [selectPath, toggleExpanded]);

  const handleDragStart = useCallback((e: React.DragEvent, n: FileNode) => {
    if (n.asset) {
      e.dataTransfer.setData('application/json', JSON.stringify(n.asset));
      e.dataTransfer.effectAllowed = 'copy';
      log('file_import', `Started dragging ${n.name}`);
    }
  }, [log]);

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
});

// ─── Cloud asset card ─────────────────────────────────────────────────────────
const CloudAssetCard: React.FC<{ asset: DbAsset }> = ({ asset }) => {
  const { addItem } = useCanvasStore();
  const log = useLogStore((s) => s.log);

  const thumbnailUrl = asset.thumbnailPath ? `/api/assets/${asset.thumbnailPath}` : null;

  const handleDragStart = (e: React.DragEvent) => {
    const localAsset: Asset = {
      id: asset.id,
      name: asset.name,
      type: 'image',
      path: asset.thumbnailPath ?? '',
      createdAt: new Date(asset.createdAt).getTime(),
      modifiedAt: new Date(asset.updatedAt).getTime(),
      thumbnail: thumbnailUrl ?? undefined,
      metadata: { width: asset.width ?? undefined, height: asset.height ?? undefined, prompt: asset.prompt ?? undefined },
    };
    e.dataTransfer.setData('application/json', JSON.stringify(localAsset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDoubleClick = () => {
    if (!thumbnailUrl) return;
    addItem({
      type: 'image',
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: asset.width ?? 512,
      height: asset.height ?? 512,
      rotation: 0,
      scale: Math.min(1, 300 / Math.max(asset.width ?? 512, asset.height ?? 512)),
      locked: false,
      visible: true,
      src: thumbnailUrl,
      name: asset.name,
      assetId: asset.id,
    });
    log('canvas_add', `Added ${asset.name} from cloud library`);
  };

  return (
    <div
      className={styles.cloudCard}
      draggable
      onDragStart={handleDragStart}
      onDoubleClick={handleDoubleClick}
      title={`${asset.name}${asset.prompt ? `\n${asset.prompt.slice(0, 80)}` : ''}`}
    >
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt={asset.name} className={styles.cloudThumb} />
      ) : (
        <div className={styles.cloudThumbPlaceholder}>
          {asset.type === 'IMAGE' ? <Sparkles size={16} /> : <Image size={16} />}
        </div>
      )}
      <span className={styles.cloudName}>{asset.name}</span>
    </div>
  );
};

// ─── Main ExplorerPanel ───────────────────────────────────────────────────────
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
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState<Tab>('local');

  const { assets: cloudAssets, loading: cloudLoading, refresh: refreshCloud } = useAssetLibrary();

  useEffect(() => {
    if (rootNodes.length === 0) loadDemoFiles();
  }, [rootNodes.length, loadDemoFiles]);

  const handleImportClick = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const imported = await importFiles(files);
      log('file_import', `Imported ${imported.length} file(s)`);
    }
    e.target.value = '';
  }, [importFiles, log]);

  const filteredNodes = filter
    ? rootNodes.filter((n) =>
        n.name.toLowerCase().includes(filter.toLowerCase()) ||
        n.children?.some((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
      )
    : rootNodes;

  const filteredCloud = filter
    ? cloudAssets.filter((a) => a.name.toLowerCase().includes(filter.toLowerCase()) || a.prompt?.toLowerCase().includes(filter.toLowerCase()))
    : cloudAssets;

  return (
    <aside className={styles.explorer} style={{ width }} data-density="compact">
      <div className={styles.header}>
        <h2 className={styles.title}>Explorer</h2>
        <div className={styles.headerActions}>
          <Button variant="ghost" size="sm" onClick={handleImportClick} title="Import local files">
            <Upload size={14} />
          </Button>
          {tab === 'cloud' && (
            <Button variant="ghost" size="sm" onClick={refreshCloud} title="Refresh cloud assets">
              {cloudLoading ? <Loader2 size={14} className={styles.spin} /> : <RefreshCw size={14} />}
            </Button>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'local' ? styles.tabActive : ''}`}
          onClick={() => setTab('local')}
        >
          <HardDrive size={12} />
          Local
        </button>
        <button
          className={`${styles.tab} ${tab === 'cloud' ? styles.tabActive : ''}`}
          onClick={() => { setTab('cloud'); if (session?.user) refreshCloud(); }}
          disabled={!session?.user}
          title={session?.user ? 'Cloud library' : 'Sign in to view cloud assets'}
        >
          <Cloud size={12} />
          Cloud
          {cloudAssets.length > 0 && <span className={styles.tabBadge}>{cloudAssets.length}</span>}
        </button>
      </div>

      <div className={styles.filterBar}>
        <Input
          placeholder={tab === 'cloud' ? 'Filter by name or prompt…' : 'Filter files…'}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* Local tab */}
      {tab === 'local' && (
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
      )}

      {/* Cloud tab */}
      {tab === 'cloud' && (
        <div className={styles.cloudGrid}>
          {!session?.user && (
            <div className={styles.empty}>
              <Cloud size={24} style={{ opacity: 0.3 }} />
              <p>Sign in to see your cloud assets</p>
            </div>
          )}
          {session?.user && cloudLoading && filteredCloud.length === 0 && (
            <div className={styles.empty}>
              <Loader2 size={16} className={styles.spin} style={{ opacity: 0.5 }} />
              <p>Loading cloud assets…</p>
            </div>
          )}
          {session?.user && !cloudLoading && filteredCloud.length === 0 && (
            <div className={styles.empty}>
              <Sparkles size={24} style={{ opacity: 0.3 }} />
              <p>No cloud assets yet</p>
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                Generated images appear here automatically.
              </p>
            </div>
          )}
          {filteredCloud.map((asset) => (
            <CloudAssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}

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
