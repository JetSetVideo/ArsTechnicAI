/**
 * HomeLeftPanel — Left sidebar for the home dashboard.
 * Connected to real fileStore data. Shows folder tree,
 * asset categories with live counts, quick actions.
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  FolderOpen, FolderPlus, FileText, Image, Film, Music,
  ChevronRight, ChevronDown, Trash2, Copy, Sparkles, Pencil, Download,
  Users, BookOpen, Palette, RefreshCw, FolderClock, GitBranch,
} from 'lucide-react';
import { useFileStore } from '../../stores/fileStore';
import { useProjectsStore } from '../../stores/projectsStore';
import { WorkflowMenu } from '../workshop/WorkflowMenu';
import { BlueprintShelf } from '../workshop/BlueprintShelf';
import styles from './HomeLeftPanel.module.css';
import type { FileNode, Asset } from '../../types';

interface FolderNode {
  id: string;
  name: string;
  type: 'folder' | 'asset';
  assetType?: 'image' | 'video' | 'audio' | 'text' | 'character' | 'template' | 'folder';
  children?: FolderNode[];
  count?: number;
  asset?: Asset;
}

interface HomeLeftPanelProps {
  onSelectFolder?: (path: string) => void;
  onNewFolder?: () => void;
  onNewProject?: () => void;
  onOpenCharacterCreator?: () => void;
  onToggleAssetCreator?: () => void;
  assetCreatorOpen?: boolean;
  onOpenTemplate?: () => void;
  onToolAction?: (id: string) => void;
  activeTool?: string;
  selectedPath?: string;
}

/** Convert fileStore rootNodes + assets into FolderNode tree */
function buildFolderTree(
  nodes: FileNode[],
  assets: Map<string, Asset>,
  depth: number = 0,
): FolderNode[] {
  return nodes.map(node => {
    const isFolder = node.type === 'folder';
    const asset = node.asset;
    const assetType = asset?.type as FolderNode['assetType'];

    // Count all descendant assets
    let count: number | undefined;
    if (isFolder && node.children) {
      count = countAssetsInTree(node);
    } else if (asset) {
      count = 1;
    }

    return {
      id: node.path || node.id,
      name: node.name,
      type: isFolder ? 'folder' : 'asset',
      assetType: isFolder ? 'folder' : assetType || 'image',
      children: node.children ? buildFolderTree(node.children, assets, depth + 1) : undefined,
      count,
      asset: asset || undefined,
    };
  });
}

function countAssetsInTree(node: FileNode): number {
  let count = 0;
  if (node.asset) count++;
  if (node.children) {
    for (const child of node.children) {
      count += countAssetsInTree(child);
    }
  }
  return count;
}

const FolderItem: React.FC<{
  node: FolderNode;
  depth: number;
  selectedPath?: string;
  onSelect: (id: string) => void;
}> = ({ node, depth, selectedPath, onSelect }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedPath === node.id;

  const getIcon = () => {
    if (!hasChildren && node.type !== 'folder') {
      switch (node.assetType) {
        case 'image': return <Image size={12} />;
        case 'video': return <Film size={12} />;
        case 'audio': return <Music size={12} />;
        case 'text': return <FileText size={12} />;
        case 'character': return <Users size={12} />;
        case 'template': return <BookOpen size={12} />;
        default: return <FileText size={12} />;
      }
    }
    if (hasChildren) {
      return expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />;
    }
    return <FolderOpen size={12} />;
  };

  return (
    <div>
      <button
        className={`${styles.folderItem} ${isSelected ? styles.folderItemActive : ''}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onSelect(node.id);
        }}
      >
        <span className={styles.folderIcon}>{getIcon()}</span>
        <span className={styles.folderName}>{node.name}</span>
        {node.count != null && node.count > 0 && (
          <span className={styles.folderCount}>{node.count}</span>
        )}
      </button>
      {expanded && hasChildren && (
        <div className={styles.folderChildren}>
          {node.children!.map(child => (
            <FolderItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TOOL_GROUPS: { id: string; label: string; tools: { id: string; label: string }[] }[] = [
  { id: 'generate', label: 'Generate', tools: [
    { id: 'gen-image', label: 'Image' },
    { id: 'gen-video', label: 'Video' },
    { id: 'gen-music', label: 'Sound' },
    { id: 'character', label: 'Character' },
    { id: 'template', label: 'Template' },
  ]},
  { id: 'draw', label: 'Draw', tools: [
    { id: 'brush', label: 'Brush' },
    { id: 'eraser', label: 'Eraser' },
    { id: 'text', label: 'Text' },
  ]},
  { id: 'export', label: 'Export', tools: [
    { id: 'export', label: 'Export' },
    { id: 'publish', label: 'Publish' },
  ]},
];

export const HomeLeftPanel: React.FC<HomeLeftPanelProps> = ({
  onSelectFolder, onNewFolder, onToggleAssetCreator, assetCreatorOpen,
  onOpenCharacterCreator, onOpenTemplate, onToolAction, activeTool, selectedPath,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [shelvesOpen, setShelvesOpen] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(max-width: 800px)').matches) setCollapsed(true);
  }, []);

  // Connect to real stores
  const rootNodes = useFileStore((s) => s.rootNodes);
  const assets = useFileStore((s) => s.assets);
  const createFolder = useFileStore((s) => s.createFolder);
  const projectCount = useProjectsStore((s) => s.projects.length);

  // Build dynamic folder tree from real data
  const folderTree = useMemo(() => {
    if (!rootNodes || rootNodes.length === 0) {
      // Fallback to showing assets by type
      const allAssets = Array.from(assets?.values() || []);
      const byType: Record<string, Asset[]> = {};
      for (const a of allAssets) {
        const t = a.type || 'image';
        if (!byType[t]) byType[t] = [];
        byType[t].push(a);
      }
      return [
        {
          id: 'all-assets', name: 'All Assets', type: 'folder' as const,
          children: Object.entries(byType).map(([type, items]) => ({
            id: `assets-${type}`,
            name: `${type.charAt(0).toUpperCase() + type.slice(1)}s`,
            type: 'folder' as const,
            assetType: type as FolderNode['assetType'],
            count: items.length,
          })),
        },
        { id: 'characters-root', name: 'Characters', type: 'folder' as const, children: [] },
        { id: 'templates-root', name: 'Templates', type: 'folder' as const, children: [] },
      ];
    }
    return buildFolderTree(rootNodes, assets || new Map());
  }, [rootNodes, assets, refreshKey]);

  const totalAssets = assets?.size || 0;

  const handleSelect = useCallback((id: string) => {
    onSelectFolder?.(id);
  }, [onSelectFolder]);

  const handleRefresh = () => setRefreshKey(k => k + 1);

  if (collapsed) {
    return (
      <div className={styles.panelCollapsed}>
        <button className={styles.expandBtn} onClick={() => setCollapsed(false)} title="Expand panel">
          <ChevronRight size={14} />
        </button>
        <div className={styles.collapsedIcons}>
          <button title="Assets" onClick={() => { setCollapsed(false); onSelectFolder?.('all-assets'); }}>
            <FolderOpen size={14} />
          </button>
          <button title="Asset Creator" onClick={() => { setCollapsed(false); (onToggleAssetCreator ?? onOpenCharacterCreator)?.(); }}>
            <Users size={14} />
          </button>
          <button title="Templates" onClick={() => { setCollapsed(false); onOpenTemplate?.(); }}>
            <BookOpen size={14} />
          </button>
          <button title="Blueprints" onClick={() => setCollapsed(false)}>
            <GitBranch size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <button onClick={() => setCollapsed(true)} title="Collapse"><ChevronRight size={13} /></button>
        <div className={styles.inventory}>
          <span>Workspace</span>
          <strong>{totalAssets} assets</strong>
          <strong>{projectCount} {projectCount === 1 ? 'project' : 'projects'}</strong>
        </div>
      </div>

      <div className={styles.panelBody}>
        <div className={styles.quickActions}>
          {TOOL_GROUPS.map((group) => (
            <div key={group.id} className={styles.toolGroup}>
              <button className={styles.quickAction} onClick={() => {
                setOpenGroup(openGroup === group.id ? null : group.id);
                if (group.id === 'generate') onToolAction?.('gen-image');
              }}>
                {group.id === 'generate' ? <Sparkles size={12} /> : group.id === 'draw' ? <Pencil size={12} /> : <Download size={12} />}
                {openGroup === group.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />} {group.label}
              </button>
              {openGroup === group.id && group.tools.map((tool) => (
                <button
                  key={tool.id}
                  className={`${styles.quickAction} ${styles.toolItem} ${activeTool === tool.id ? styles.quickActionActive : ''}`}
                  onClick={() => onToolAction?.(tool.id)}
                >
                  {tool.label}
                </button>
              ))}
            </div>
          ))}
          <button
            className={`${styles.quickAction} ${assetCreatorOpen ? styles.quickActionActive : ''}`}
            onClick={onToggleAssetCreator ?? onOpenCharacterCreator}
            aria-expanded={assetCreatorOpen}
          >
            <Palette size={12} /> Asset Creator
          </button>
          <button className={styles.quickAction} onClick={onOpenTemplate}>
            <BookOpen size={12} /> New Template
          </button>
          <WorkflowMenu
            scope="global"
            inline
            renderTrigger={({ toggle, open }) => (
              <button className={styles.quickAction} onClick={toggle} aria-expanded={open}>
                <FolderClock size={12} /> Workflows
              </button>
            )}
          />
          <BlueprintShelf variant="home" />
          <button className={styles.quickAction} onClick={() => setShelvesOpen((open) => !open)} aria-expanded={shelvesOpen}>
            <FolderOpen size={12} /> {shelvesOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Files
          </button>
        </div>
        {shelvesOpen && (
          <div className={styles.folderTree}>
            <div className={styles.fileActions}>
              <button title="Refresh the file list" onClick={handleRefresh}><RefreshCw size={11} /> Refresh</button>
              <button title="New folder in the workspace" onClick={() => {
                const name = window.prompt('Folder name');
                if (!name?.trim()) return;
                createFolder(selectedPath && !selectedPath.startsWith('all-') ? selectedPath : '/', name.trim());
                onNewFolder?.();
              }}><FolderPlus size={12} /> Folder</button>
            </div>
            {folderTree.map(node => (
              <FolderItem
                key={node.id}
                node={node}
                depth={0}
                selectedPath={selectedPath}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeLeftPanel;
