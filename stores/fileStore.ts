import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { FileNode, Asset, ImageAsset } from '@/types';

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

  // Folder operations
  addFileToFolder: (folderPath: string, fileName: string, asset: Asset) => FileNode | null;
  createFolder: (parentPath: string, name: string) => FileNode | null;
  ensureFolderExists: (path: string, name: string) => void;

  // Navigation
  selectPath: (path: string | null) => void;
  toggleExpanded: (path: string) => void;
  expandPath: (path: string) => void;
  collapsePath: (path: string) => void;

  // Project management
  setCurrentProject: (projectName: string) => void;
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

export const useFileStore = create<FileState>()(
  persist(
    (set, get) => ({
      rootNodes: [],
      assets: new Map(),
      selectedPath: null,
      expandedPaths: new Set(),
      currentProjectPath: '/projects/untitled-project',

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
        const projectPath = `/projects/${projectName.toLowerCase().replace(/\s+/g, '-')}`;
        set({ currentProjectPath: projectPath });
        
        // Ensure project folder exists with Generated subfolder
        get().ensureFolderExists(projectPath, projectName);
        get().ensureFolderExists(`${projectPath}/generated`, 'Generated');
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
            path: `/imports/${file.name}`,
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

          // Add to assets and tree
          get().addAssetToFolder(asset, '/imports');
          importedAssets.push(asset);
        }

        return importedAssets;
      },

      // Initialize file structure with project support
      initializeFileStructure: (projectName = 'Untitled Project') => {
        const projectSlug = projectName.toLowerCase().replace(/\s+/g, '-');
        const projectPath = `/projects/${projectSlug}`;

        const structure: FileNode[] = [
          {
            id: uuidv4(),
            name: 'Imports',
            type: 'folder',
            path: '/imports',
            children: [],
            expanded: true,
          },
          {
            id: uuidv4(),
            name: 'Projects',
            type: 'folder',
            path: '/projects',
            children: [
              {
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
              },
            ],
            expanded: true,
          },
          {
            id: uuidv4(),
            name: 'Prompts',
            type: 'folder',
            path: '/prompts',
            children: [],
            expanded: false,
          },
        ];

        set({
          rootNodes: structure,
          currentProjectPath: projectPath,
          expandedPaths: new Set(['/imports', '/projects', projectPath, `${projectPath}/generated`]),
        });
      },
    }),
    {
      name: 'ars-technicai-files',
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
