import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { FileNode, Asset, ImageAsset } from '@/types';

interface FileState {
  rootNodes: FileNode[];
  assets: Map<string, Asset>;
  selectedPath: string | null;
  expandedPaths: Set<string>;

  // File operations
  setRootNodes: (nodes: FileNode[]) => void;
  addAsset: (asset: Asset) => void;
  removeAsset: (id: string) => void;
  getAsset: (id: string) => Asset | undefined;

  // Navigation
  selectPath: (path: string | null) => void;
  toggleExpanded: (path: string) => void;
  expandPath: (path: string) => void;
  collapsePath: (path: string) => void;

  // File import from browser
  importFiles: (files: FileList) => Promise<ImageAsset[]>;

  // Create folder structure
  addFolder: (parentPath: string, name: string) => FileNode;

  // Demo data
  loadDemoFiles: () => void;
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

export const useFileStore = create<FileState>((set, get) => ({
  rootNodes: [],
  assets: new Map(),
  selectedPath: null,
  expandedPaths: new Set(),

  setRootNodes: (nodes) => set({ rootNodes: nodes }),

  addAsset: (asset) => {
    set((state) => {
      const newAssets = new Map(state.assets);
      newAssets.set(asset.id, asset);
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

      get().addAsset(asset);
      importedAssets.push(asset);

      // Add to file tree under imports
      set((state) => {
        const importFolder = state.rootNodes.find((n) => n.name === 'Imports');
        if (importFolder && importFolder.children) {
          const fileNode = createFileNode(file.name, 'file', asset.path, asset);
          importFolder.children = [...importFolder.children, fileNode];
        }
        return { rootNodes: [...state.rootNodes] };
      });
    }

    return importedAssets;
  },

  addFolder: (parentPath, name) => {
    const folderPath = `${parentPath}/${name}`;
    const folder = createFileNode(name, 'folder', folderPath);

    set((state) => {
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

  loadDemoFiles: () => {
    const demoStructure: FileNode[] = [
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
        name: 'Generated',
        type: 'folder',
        path: '/generated',
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
            name: 'My First Project',
            type: 'folder',
            path: '/projects/my-first-project',
            children: [],
            expanded: false,
          },
        ],
        expanded: false,
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
      rootNodes: demoStructure,
      expandedPaths: new Set(['/imports', '/generated']),
    });
  },
}));
