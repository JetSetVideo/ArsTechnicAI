import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { FileNode, Asset, ImageAsset } from '@/types';
import { projectPathFromName } from '@/utils/project';
import {
  STORAGE_KEYS,
  WORKSPACE_DEFAULTS,
  WORKSPACE_PROTECTED_PATHS,
  WORKSPACE_ROOT_NAMES,
  WORKSPACE_ROOT_PATHS,
} from '@/constants/workspace';

// ════════════════════════════════════════════════════════════════════════════
// FILE STORE - Manages file tree and assets
// ════════════════════════════════════════════════════════════════════════════

interface FileState {
  rootNodes: FileNode[];
  assets: Map<string, Asset>;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  currentProjectPath: string;

  // File operations
  setRootNodes: (nodes: FileNode[]) => void;
  addAsset: (asset: Asset) => void;
  addAssetToFolder: (asset: Asset, folderPath: string) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  removeAsset: (id: string) => void;
  getAsset: (id: string) => Asset | undefined;
  findPromptAsset: (promptText: string) => Asset | undefined;
  createPromptAsset: (promptText: string) => Asset;
  getAssetsByLineage: (lineageId: string) => Asset[];
  getAssetsByParentId: (parentAssetId: string) => Asset[];

  // Folder operations
  addFileToFolder: (folderPath: string, fileName: string, asset: Asset) => FileNode | null;
  createFolder: (parentPath: string, name: string) => FileNode | null;
  ensureFolderExists: (path: string, name: string) => void;
  findNodeByPath: (path: string) => FileNode | null;
  deleteNode: (path: string) => boolean;
  renameNode: (path: string, newName: string) => boolean;
  moveNode: (sourcePath: string, targetFolderPath: string) => boolean;

  // Navigation
  selectPath: (path: string | null) => void;
  toggleExpanded: (path: string) => void;
  expandPath: (path: string) => void;
  collapsePath: (path: string) => void;

  // Project management
  setCurrentProject: (projectName: string) => void;
  switchToProject: (projectName: string) => void;
  getProjectGeneratedPath: () => string;

  // File import from browser
  importFiles: (files: FileList) => Promise<ImageAsset[]>;

  // Initialize structure
  initializeFileStructure: (projectName?: string) => void;
}

// Helper to create file node
const createFileNode = (
  name: string,
  type: 'file' | 'folder',
  path: string,
  asset?: Asset
): FileNode => ({
  id: uuidv4(),
  name,
  type,
  path,
  children: type === 'folder' ? [] : undefined,
  expanded: false,
  asset,
});

const createProjectFolderNode = (projectName: string, projectPath: string): FileNode => ({
  id: uuidv4(),
  name: projectName,
  type: 'folder',
  path: projectPath,
  children: [
    {
      id: uuidv4(),
      name: 'Generated',
      type: 'folder',
      path: `${projectPath}/generated`,
      children: [],
      expanded: true,
    },
    {
      id: uuidv4(),
      name: 'Exports',
      type: 'folder',
      path: `${projectPath}/exports`,
      children: [],
      expanded: false,
    },
  ],
  expanded: true,
});

const normalizePath = (path: string) => path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

const getParentPath = (path: string) => {
  const normalized = normalizePath(path);
  if (normalized === '/') return '/';
  const parts = normalized.split('/');
  parts.pop();
  const parent = parts.join('/');
  return parent || '/';
};

const getBaseName = (path: string) => {
  const normalized = normalizePath(path);
  if (normalized === '/') return '/';
  const parts = normalized.split('/');
  return parts[parts.length - 1] || '';
};

const findNodeByPathInTree = (nodes: FileNode[], targetPath: string): FileNode | null => {
  const normalizedTarget = normalizePath(targetPath);
  for (const node of nodes) {
    if (normalizePath(node.path) === normalizedTarget) return node;
    if (node.children) {
      const found = findNodeByPathInTree(node.children, normalizedTarget);
      if (found) return found;
    }
  }
  return null;
};

const listDescendantNodes = (node: FileNode): FileNode[] => {
  const out: FileNode[] = [node];
  (node.children || []).forEach((child) => out.push(...listDescendantNodes(child)));
  return out;
};

export const useFileStore = create<FileState>()(
  persist(
    (set, get) => ({
      rootNodes: [],
      assets: new Map(),
      selectedPath: null,
      expandedPaths: new Set(),
      currentProjectPath: projectPathFromName(WORKSPACE_DEFAULTS.projectName),

      setRootNodes: (nodes) => set({ rootNodes: nodes }),

      addAsset: (asset) => {
        set((state) => {
          const newAssets = new Map(state.assets);
          newAssets.set(asset.id, asset);
          return { assets: newAssets };
        });
      },

      // Add asset and also add it to the folder tree
      addAssetToFolder: (asset, folderPath) => {
        // First add to assets map
        get().addAsset(asset);
        
        // Then add to the tree
        get().addFileToFolder(folderPath, asset.name, asset);
      },

      updateAsset: (id, updates) => {
        set((state) => {
          const newAssets = new Map(state.assets);
          const existing = newAssets.get(id);
          if (existing) {
            newAssets.set(id, { ...existing, ...updates, modifiedAt: Date.now() });
          }
          return { assets: newAssets };
        });
      },

      removeAsset: (id) => {
        set((state) => {
          const newAssets = new Map(state.assets);
          newAssets.delete(id);
          return { assets: newAssets };
        });
      },

      getAsset: (id) => get().assets.get(id),

      findPromptAsset: (promptText) => {
        const normalized = promptText.trim();
        if (!normalized) return undefined;
        return Array.from(get().assets.values()).find(
          (asset) =>
            asset.type === 'prompt' &&
            typeof asset.metadata?.prompt === 'string' &&
            asset.metadata.prompt.trim() === normalized
        );
      },

      createPromptAsset: (promptText) => {
        const normalized = promptText.trim();
        const promptAsset: Asset = {
          id: uuidv4(),
          name: normalized.slice(0, 60) || 'Untitled Prompt',
          type: 'prompt',
          path: `/prompts/${normalized.slice(0, 60).replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'prompt'}.txt`,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          metadata: {
            prompt: normalized,
          },
        };

        get().ensureFolderExists('/prompts', 'Prompts');
        get().addAssetToFolder(promptAsset, '/prompts');

        return promptAsset;
      },

      getAssetsByLineage: (lineageId) => {
        if (!lineageId) return [];
        return Array.from(get().assets.values()).filter(
          (asset) => asset.metadata?.lineageId === lineageId
        );
      },

      getAssetsByParentId: (parentAssetId) => {
        if (!parentAssetId) return [];
        return Array.from(get().assets.values()).filter(
          (asset) => asset.metadata?.parentAssetId === parentAssetId
        );
      },

      // Add a file to a specific folder in the tree
      addFileToFolder: (folderPath, fileName, asset) => {
        const fileNode = createFileNode(fileName, 'file', `${folderPath}/${fileName}`, asset);
        
        set((state) => {
          const updateTree = (nodes: FileNode[]): FileNode[] => {
            return nodes.map((node) => {
              if (node.path === folderPath && node.type === 'folder') {
                // Found the folder, add the file
                const existingChildren = node.children || [];
                // Check if file already exists
                const exists = existingChildren.some(c => c.name === fileName);
                if (exists) {
                  // Update existing file
                  return {
                    ...node,
                    children: existingChildren.map(c => 
                      c.name === fileName ? { ...c, asset } : c
                    ),
                  };
                }
                return {
                  ...node,
                  children: [...existingChildren, fileNode],
                };
              }
              if (node.children) {
                return { ...node, children: updateTree(node.children) };
              }
              return node;
            });
          };

          return { rootNodes: updateTree(state.rootNodes) };
        });

        // Auto-expand the folder
        get().expandPath(folderPath);
        
        return fileNode;
      },

      // Create a new folder
      createFolder: (parentPath, name) => {
        const folderPath = parentPath ? `${parentPath}/${name}` : `/${name}`;
        const folder = createFileNode(name, 'folder', folderPath);

        set((state) => {
          if (!parentPath || parentPath === '/') {
            // Add to root
            return { rootNodes: [...state.rootNodes, folder] };
          }

          const updateChildren = (nodes: FileNode[]): FileNode[] => {
            return nodes.map((node) => {
              if (node.path === parentPath && node.type === 'folder') {
                return {
                  ...node,
                  children: [...(node.children || []), folder],
                };
              }
              if (node.children) {
                return { ...node, children: updateChildren(node.children) };
              }
              return node;
            });
          };

          return { rootNodes: updateChildren(state.rootNodes) };
        });

        return folder;
      },

      // Ensure a folder exists in the tree
      ensureFolderExists: (path, name) => {
        const { rootNodes } = get();
        
        const findFolder = (nodes: FileNode[], targetPath: string): FileNode | null => {
          for (const node of nodes) {
            if (node.path === targetPath) return node;
            if (node.children) {
              const found = findFolder(node.children, targetPath);
              if (found) return found;
            }
          }
          return null;
        };

        if (!findFolder(rootNodes, path)) {
          // Folder doesn't exist, create it
          const parentPath = path.split('/').slice(0, -1).join('/') || '/';
          get().createFolder(parentPath, name);
        }
      },

      findNodeByPath: (path) => {
        return findNodeByPathInTree(get().rootNodes, path);
      },

      deleteNode: (path) => {
        const targetPath = normalizePath(path);
        if (WORKSPACE_PROTECTED_PATHS.has(targetPath)) {
          return false;
        }

        const sourceNode = findNodeByPathInTree(get().rootNodes, targetPath);
        if (!sourceNode) return false;
        const descendantAssetIds = listDescendantNodes(sourceNode)
          .map((node) => node.asset?.id)
          .filter((id): id is string => Boolean(id));

        let removed = false;
        set((state) => {
          const removeFromTree = (nodes: FileNode[]): FileNode[] =>
            nodes
              .filter((node) => {
                const keep = normalizePath(node.path) !== targetPath;
                if (!keep) removed = true;
                return keep;
              })
              .map((node) =>
                node.children ? { ...node, children: removeFromTree(node.children) } : node
              );

          const nextAssets = new Map(state.assets);
          descendantAssetIds.forEach((id) => nextAssets.delete(id));

          const nextSelectedPath =
            state.selectedPath && state.selectedPath.startsWith(targetPath)
              ? null
              : state.selectedPath;

          const nextExpanded = new Set(
            Array.from(state.expandedPaths).filter((p) => !p.startsWith(targetPath))
          );

          return {
            rootNodes: removeFromTree(state.rootNodes),
            assets: nextAssets,
            selectedPath: nextSelectedPath,
            expandedPaths: nextExpanded,
          };
        });

        return removed;
      },

      renameNode: (path, newName) => {
        const targetPath = normalizePath(path);
        const safeName = newName.trim();
        if (!safeName || targetPath === '/') return false;

        const sourceNode = findNodeByPathInTree(get().rootNodes, targetPath);
        if (!sourceNode) return false;

        const parentPath = getParentPath(targetPath);
        const nextPath = normalizePath(`${parentPath}/${safeName}`);
        if (nextPath === targetPath) return true;
        if (findNodeByPathInTree(get().rootNodes, nextPath)) return false;

        const descendants = listDescendantNodes(sourceNode);
        const assetPathChanges = descendants
          .filter((node) => node.asset?.id)
          .map((node) => ({
            id: node.asset!.id,
            oldPath: normalizePath(node.asset!.path),
            newPath: normalizePath(node.asset!.path).replace(targetPath, nextPath),
          }));

        let renamed = false;
        set((state) => {
          const renameInTree = (nodes: FileNode[]): FileNode[] =>
            nodes.map((node) => {
              const nodePath = normalizePath(node.path);
              if (nodePath === targetPath || nodePath.startsWith(`${targetPath}/`)) {
                renamed = true;
                const updatedPath = nodePath.replace(targetPath, nextPath);
                const updatedAsset = node.asset
                  ? {
                      ...node.asset,
                      path: normalizePath(node.asset.path).replace(targetPath, nextPath),
                      modifiedAt: Date.now(),
                    }
                  : undefined;
                return {
                  ...node,
                  name: nodePath === targetPath ? safeName : getBaseName(updatedPath),
                  path: updatedPath,
                  asset: updatedAsset,
                  children: node.children ? renameInTree(node.children) : node.children,
                };
              }
              return node.children
                ? { ...node, children: renameInTree(node.children) }
                : node;
            });

          const nextAssets = new Map(state.assets);
          assetPathChanges.forEach(({ id, newPath }) => {
            const existing = nextAssets.get(id);
            if (existing) nextAssets.set(id, { ...existing, path: newPath, modifiedAt: Date.now() });
          });

          const nextExpanded = new Set<string>();
          state.expandedPaths.forEach((p) => {
            if (p === targetPath || p.startsWith(`${targetPath}/`)) {
              nextExpanded.add(p.replace(targetPath, nextPath));
            } else {
              nextExpanded.add(p);
            }
          });

          const nextSelectedPath =
            state.selectedPath && (state.selectedPath === targetPath || state.selectedPath.startsWith(`${targetPath}/`))
              ? state.selectedPath.replace(targetPath, nextPath)
              : state.selectedPath;

          return {
            rootNodes: renameInTree(state.rootNodes),
            assets: nextAssets,
            expandedPaths: nextExpanded,
            selectedPath: nextSelectedPath,
          };
        });

        return renamed;
      },

      moveNode: (sourcePath, targetFolderPath) => {
        const source = normalizePath(sourcePath);
        const target = normalizePath(targetFolderPath);
        if (!source || source === '/' || source === target) return false;

        const sourceNode = findNodeByPathInTree(get().rootNodes, source);
        const targetNode = findNodeByPathInTree(get().rootNodes, target);
        if (!sourceNode || !targetNode || targetNode.type !== 'folder') return false;
        if (target.startsWith(`${source}/`)) return false;

        const destinationPath = normalizePath(`${target}/${sourceNode.name}`);
        if (findNodeByPathInTree(get().rootNodes, destinationPath)) return false;

        const descendants = listDescendantNodes(sourceNode);
        const assetPathChanges = descendants
          .filter((node) => node.asset?.id)
          .map((node) => ({
            id: node.asset!.id,
            newPath: normalizePath(node.asset!.path).replace(source, destinationPath),
          }));

        let moved = false;
        set((state) => {
          const removeNode = (nodes: FileNode[]): FileNode[] =>
            nodes
              .filter((node) => normalizePath(node.path) !== source)
              .map((node) =>
                node.children ? { ...node, children: removeNode(node.children) } : node
              );

          const updateSubtreePaths = (node: FileNode): FileNode => {
            const nodePath = normalizePath(node.path);
            const nextPath = nodePath.replace(source, destinationPath);
            return {
              ...node,
              path: nextPath,
              asset: node.asset
                ? { ...node.asset, path: normalizePath(node.asset.path).replace(source, destinationPath), modifiedAt: Date.now() }
                : undefined,
              children: node.children?.map(updateSubtreePaths),
            };
          };

          const sourceTreeNode = findNodeByPathInTree(state.rootNodes, source);
          if (!sourceTreeNode) return state;
          const movedNode = updateSubtreePaths(sourceTreeNode);

          const insertNode = (nodes: FileNode[]): FileNode[] =>
            nodes.map((node) => {
              if (normalizePath(node.path) === target && node.type === 'folder') {
                moved = true;
                const children = node.children || [];
                return { ...node, children: [...children, movedNode] };
              }
              return node.children ? { ...node, children: insertNode(node.children) } : node;
            });

          const withoutSource = removeNode(state.rootNodes);
          const withTarget = insertNode(withoutSource);

          const nextAssets = new Map(state.assets);
          assetPathChanges.forEach(({ id, newPath }) => {
            const existing = nextAssets.get(id);
            if (existing) nextAssets.set(id, { ...existing, path: newPath, modifiedAt: Date.now() });
          });

          const nextExpanded = new Set<string>();
          state.expandedPaths.forEach((p) => {
            if (p === source || p.startsWith(`${source}/`)) {
              nextExpanded.add(p.replace(source, destinationPath));
            } else {
              nextExpanded.add(p);
            }
          });
          nextExpanded.add(target);

          const nextSelectedPath =
            state.selectedPath && (state.selectedPath === source || state.selectedPath.startsWith(`${source}/`))
              ? state.selectedPath.replace(source, destinationPath)
              : state.selectedPath;

          return {
            rootNodes: withTarget,
            assets: nextAssets,
            expandedPaths: nextExpanded,
            selectedPath: nextSelectedPath,
          };
        });

        return moved;
      },

      selectPath: (path) => set({ selectedPath: path }),

      toggleExpanded: (path) => {
        set((state) => {
          const newExpanded = new Set(state.expandedPaths);
          if (newExpanded.has(path)) {
            newExpanded.delete(path);
          } else {
            newExpanded.add(path);
          }
          return { expandedPaths: newExpanded };
        });
      },

      expandPath: (path) => {
        set((state) => {
          const newExpanded = new Set(state.expandedPaths);
          newExpanded.add(path);
          return { expandedPaths: newExpanded };
        });
      },

      collapsePath: (path) => {
        set((state) => {
          const newExpanded = new Set(state.expandedPaths);
          newExpanded.delete(path);
          return { expandedPaths: newExpanded };
        });
      },

      setCurrentProject: (projectName) => {
        get().switchToProject(projectName);
      },

      switchToProject: (projectName) => {
        const safeName = projectName.trim() || WORKSPACE_DEFAULTS.projectName;
        const projectPath = projectPathFromName(safeName);
        const state = get();

        // Avoid rebuilding tree when already on the same project.
        if (state.currentProjectPath === projectPath && state.rootNodes.length > 0) {
          return;
        }

        // If tree is empty, initialize from scratch.
        if (state.rootNodes.length === 0) {
          get().initializeFileStructure(safeName);
          return;
        }

        const pickRootFolder = (path: string, defaultName: string) =>
          state.rootNodes.find((node) => node.type === 'folder' && node.path === path) ||
          createFileNode(defaultName, 'folder', path);

        const importsFolder = pickRootFolder(WORKSPACE_ROOT_PATHS.imports, WORKSPACE_ROOT_NAMES.imports);
        const libraryFolder = pickRootFolder(WORKSPACE_ROOT_PATHS.library, WORKSPACE_ROOT_NAMES.library);
        const promptsFolder = pickRootFolder(WORKSPACE_ROOT_PATHS.prompts, WORKSPACE_ROOT_NAMES.prompts);

        const projectsRoot =
          state.rootNodes.find((node) => node.type === 'folder' && node.path === WORKSPACE_ROOT_PATHS.projects) ||
          createFileNode(WORKSPACE_ROOT_NAMES.projects, 'folder', WORKSPACE_ROOT_PATHS.projects);

        const nextProjectsRoot: FileNode = {
          ...projectsRoot,
          children: [createProjectFolderNode(safeName, projectPath)],
          expanded: true,
        };

        set({
          rootNodes: [importsFolder, libraryFolder, nextProjectsRoot, promptsFolder],
          currentProjectPath: projectPath,
          selectedPath: null,
          expandedPaths: new Set([
            WORKSPACE_ROOT_PATHS.imports,
            WORKSPACE_ROOT_PATHS.library,
            WORKSPACE_ROOT_PATHS.projects,
            projectPath,
            `${projectPath}/generated`,
            WORKSPACE_ROOT_PATHS.prompts,
          ]),
        });
      },

      getProjectGeneratedPath: () => {
        return `${get().currentProjectPath}/generated`;
      },

      importFiles: async (files) => {
        const importedAssets: ImageAsset[] = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          if (!file.type.startsWith('image/')) continue;

          // Read file as data URL
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });

          // Get image dimensions
          const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.src = dataUrl;
          });

          const asset: ImageAsset = {
            id: uuidv4(),
            name: file.name,
            type: 'image',
            path: `${WORKSPACE_ROOT_PATHS.library}/${file.name}`,
            size: file.size,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            thumbnail: dataUrl,
            width: dimensions.width,
            height: dimensions.height,
            dataUrl,
            metadata: {
              width: dimensions.width,
              height: dimensions.height,
              mimeType: file.type,
            },
          };

          // Add to assets and shared Library so assets can be reused across projects
          get().addAssetToFolder(asset, '/library');
          importedAssets.push(asset);
        }

        return importedAssets;
      },

      // Initialize file structure with project support
      initializeFileStructure: (projectName = WORKSPACE_DEFAULTS.projectName) => {
        const safeName = projectName.trim() || WORKSPACE_DEFAULTS.projectName;
        const projectPath = projectPathFromName(safeName);

        const structure: FileNode[] = [
          {
            id: uuidv4(),
            name: WORKSPACE_ROOT_NAMES.imports,
            type: 'folder',
            path: WORKSPACE_ROOT_PATHS.imports,
            children: [],
            expanded: true,
          },
          {
            id: uuidv4(),
            name: WORKSPACE_ROOT_NAMES.library,
            type: 'folder',
            path: WORKSPACE_ROOT_PATHS.library,
            children: [],
            expanded: true,
          },
          {
            id: uuidv4(),
            name: WORKSPACE_ROOT_NAMES.projects,
            type: 'folder',
            path: WORKSPACE_ROOT_PATHS.projects,
            children: [
              createProjectFolderNode(safeName, projectPath),
            ],
            expanded: true,
          },
          {
            id: uuidv4(),
            name: WORKSPACE_ROOT_NAMES.prompts,
            type: 'folder',
            path: WORKSPACE_ROOT_PATHS.prompts,
            children: [],
            expanded: false,
          },
        ];

        set({
          rootNodes: structure,
          currentProjectPath: projectPath,
          expandedPaths: new Set([
            WORKSPACE_ROOT_PATHS.imports,
            WORKSPACE_ROOT_PATHS.library,
            WORKSPACE_ROOT_PATHS.projects,
            projectPath,
            `${projectPath}/generated`,
          ]),
        });
      },
    }),
    {
      name: STORAGE_KEYS.files,
      // Custom serialization for Map and Set
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const data = JSON.parse(str);
          return {
            state: {
              ...data.state,
              assets: new Map(data.state.assets || []),
              expandedPaths: new Set(data.state.expandedPaths || []),
            },
          };
        },
        setItem: (name, value) => {
          const data = {
            state: {
              ...value.state,
              assets: Array.from(value.state.assets?.entries() || []),
              expandedPaths: Array.from(value.state.expandedPaths || []),
            },
          };
          localStorage.setItem(name, JSON.stringify(data));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);

// Alias for backward compatibility
export const loadDemoFiles = () => {
  useFileStore.getState().initializeFileStructure();
};
