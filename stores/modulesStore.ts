/**
 * Modules Store
 * 
 * Manages the modular AI capabilities system (Blender/ComfyUI-style).
 * Handles preinstalled, downloaded, and available modules.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Module, ModuleStatus } from '../types/dashboard';

// ============================================
// PREINSTALLED MODULES
// ============================================

const PREINSTALLED_MODULES: Module[] = [
  {
    id: 'image-gen',
    name: 'Image Generation',
    description: 'Generate images from text prompts using Imagen, DALL-E, or Stable Diffusion',
    icon: 'image',
    status: 'active',
    preinstalled: true,
    price: 'free',
    version: '1.0.0',
    tags: ['generation', 'image', 'ai'],
  },
  {
    id: 'image-enhance',
    name: 'Image Enhancement',
    description: 'Upscale, denoise, and color correct images with AI',
    icon: 'sparkles',
    status: 'active',
    preinstalled: true,
    price: 'free',
    version: '1.0.0',
    tags: ['enhancement', 'upscale', 'image'],
  },
  {
    id: 'video-edit',
    name: 'Basic Video Edit',
    description: 'Cut, trim, add transitions, and adjust speed of video clips',
    icon: 'video',
    status: 'active',
    preinstalled: true,
    price: 'free',
    version: '1.0.0',
    tags: ['video', 'editing', 'basic'],
  },
  {
    id: 'audio-proc',
    name: 'Audio Processing',
    description: 'Basic audio mixing, noise reduction, and enhancement',
    icon: 'volume-2',
    status: 'active',
    preinstalled: true,
    price: 'free',
    version: '1.0.0',
    tags: ['audio', 'mixing', 'enhancement'],
  },
  {
    id: 'asset-mgr',
    name: 'Asset Manager',
    description: 'Import, organize, and tag your creative assets',
    icon: 'folder',
    status: 'active',
    preinstalled: true,
    price: 'free',
    version: '1.0.0',
    tags: ['assets', 'organization', 'import'],
  },
  {
    id: 'export-eng',
    name: 'Export Engine',
    description: 'Render and export to various formats (MP4, PNG, JPG, WebP)',
    icon: 'download',
    status: 'active',
    preinstalled: true,
    price: 'free',
    version: '1.0.0',
    tags: ['export', 'render', 'formats'],
  },
];

// ============================================
// AVAILABLE MODULES (Shop)
// ============================================

const AVAILABLE_MODULES: Module[] = [
  {
    id: 'camera-move',
    name: 'Camera Movement',
    description: 'Generate images from new camera angles and perspectives',
    icon: 'camera',
    status: 'available',
    preinstalled: false,
    price: 'free',
    version: '1.0.0',
    requiredModels: ['depth-estimation', 'novel-view'],
    tags: ['camera', '3d', 'perspective'],
  },
  {
    id: '3d-scene',
    name: '3D Scene Generator',
    description: 'Create immersive 3D environments from images or text descriptions',
    icon: 'box',
    status: 'available',
    preinstalled: false,
    price: 'premium',
    version: '1.0.0',
    requiredModels: ['gaussian-splatting', 'nerf'],
    tags: ['3d', 'scene', 'environment'],
  },
  {
    id: 'char-anim',
    name: 'Character Animator',
    description: 'Bring static characters to life with AI-powered animation',
    icon: 'user',
    status: 'available',
    preinstalled: false,
    price: 'premium',
    version: '1.0.0',
    requiredModels: ['pose-estimation', 'motion-synthesis'],
    tags: ['animation', 'character', 'motion'],
  },
  {
    id: 'voice-clone',
    name: 'Voice Cloning',
    description: 'Clone voices from samples and generate natural speech',
    icon: 'mic',
    status: 'available',
    preinstalled: false,
    price: 'premium',
    version: '1.0.0',
    requiredModels: ['voice-encoder', 'speech-synthesis'],
    tags: ['voice', 'audio', 'cloning'],
  },
  {
    id: 'music-compose',
    name: 'Music Composer',
    description: 'Generate original background music and soundtracks',
    icon: 'music',
    status: 'available',
    preinstalled: false,
    price: 'free',
    version: '1.0.0',
    requiredModels: ['music-generation'],
    tags: ['music', 'audio', 'composition'],
  },
  {
    id: 'lip-sync',
    name: 'Lip Sync',
    description: 'Automatically synchronize lip movements with audio',
    icon: 'message-circle',
    status: 'available',
    preinstalled: false,
    price: 'premium',
    version: '1.0.0',
    requiredModels: ['audio-visual-sync', 'face-landmark'],
    tags: ['lip-sync', 'video', 'audio'],
  },
  {
    id: 'motion-cap',
    name: 'Motion Capture',
    description: 'Extract motion data from video for animation',
    icon: 'activity',
    status: 'available',
    preinstalled: false,
    price: 'premium',
    version: '1.0.0',
    requiredModels: ['pose-estimation-3d', 'motion-retargeting'],
    tags: ['motion', 'capture', 'animation'],
  },
  {
    id: 'style-pro',
    name: 'Style Transfer Pro',
    description: 'Advanced artistic style transfer with fine-grained control',
    icon: 'palette',
    status: 'available',
    preinstalled: false,
    price: 'premium',
    version: '1.0.0',
    requiredModels: ['style-encoder', 'content-adaptive'],
    tags: ['style', 'artistic', 'transfer'],
  },
  {
    id: 'bg-replace',
    name: 'Background Replacer',
    description: 'AI-powered green screen without the green screen',
    icon: 'layers',
    status: 'available',
    preinstalled: false,
    price: 'free',
    version: '1.0.0',
    requiredModels: ['segmentation', 'matting'],
    tags: ['background', 'segmentation', 'compositing'],
  },
  {
    id: 'obj-track',
    name: 'Object Tracker',
    description: 'Advanced object tracking and masking across video frames',
    icon: 'target',
    status: 'available',
    preinstalled: false,
    price: 'premium',
    version: '1.0.0',
    requiredModels: ['sam', 'tracking'],
    tags: ['tracking', 'masking', 'video'],
  },
];

// ============================================
// STORE INTERFACE
// ============================================

// Track active download intervals for cleanup (not persisted)
const activeDownloads = new Map<string, ReturnType<typeof setInterval>>();

interface ModulesState {
  modules: Module[];
  downloadQueue: string[];
}

interface ModulesActions {
  // Module management
  installModule: (id: string) => void;
  uninstallModule: (id: string) => void;
  activateModule: (id: string) => void;
  deactivateModule: (id: string) => void;
  updateModuleStatus: (id: string, status: ModuleStatus, progress?: number) => void;
  
  // Getters
  getModule: (id: string) => Module | undefined;
  getPreinstalledModules: () => Module[];
  getInstalledModules: () => Module[];
  getActiveModules: () => Module[];
  getAvailableModules: () => Module[];
  getFreeModules: () => Module[];
  getPremiumModules: () => Module[];
  isModuleActive: (id: string) => boolean;
  isModuleInstalled: (id: string) => boolean;
  
  // Search
  searchModules: (query: string) => Module[];
  getModulesByTag: (tag: string) => Module[];
}

type ModulesStore = ModulesState & ModulesActions;

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useModulesStore = create<ModulesStore>()(
  persist(
    (set, get) => ({
      // Initial state - combine preinstalled and available
      modules: [...PREINSTALLED_MODULES, ...AVAILABLE_MODULES],
      downloadQueue: [],

      // Module management
      installModule: (id) => {
        const module = get().getModule(id);
        if (!module || module.preinstalled) return;
        
        // Cancel any existing download for this module
        if (activeDownloads.has(id)) {
          clearInterval(activeDownloads.get(id)!);
          activeDownloads.delete(id);
        }
        
        // Start download simulation
        set((state) => ({
          downloadQueue: [...state.downloadQueue, id],
          modules: state.modules.map((m) =>
            m.id === id ? { ...m, status: 'downloading' as ModuleStatus, downloadProgress: 0 } : m
          ),
        }));
        
        // Simulate download progress with tracked interval
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 20;
          if (progress >= 100) {
            clearInterval(interval);
            activeDownloads.delete(id);
            set((state) => ({
              downloadQueue: state.downloadQueue.filter((mid) => mid !== id),
              modules: state.modules.map((m) =>
                m.id === id
                  ? { ...m, status: 'inactive' as ModuleStatus, downloadProgress: undefined, installedAt: Date.now() }
                  : m
              ),
            }));
          } else {
            set((state) => ({
              modules: state.modules.map((m) =>
                m.id === id ? { ...m, downloadProgress: Math.min(progress, 99) } : m
              ),
            }));
          }
        }, 500);
        
        activeDownloads.set(id, interval);
      },

      uninstallModule: (id) => {
        const module = get().getModule(id);
        if (!module || module.preinstalled) return;
        
        // Cancel download in progress if any
        if (activeDownloads.has(id)) {
          clearInterval(activeDownloads.get(id)!);
          activeDownloads.delete(id);
        }
        
        set((state) => ({
          downloadQueue: state.downloadQueue.filter((mid) => mid !== id),
          modules: state.modules.map((m) =>
            m.id === id
              ? { ...m, status: 'available' as ModuleStatus, installedAt: undefined, downloadProgress: undefined }
              : m
          ),
        }));
      },

      activateModule: (id) => {
        const module = get().getModule(id);
        if (!module) return;
        
        // Can only activate installed or preinstalled modules
        if (module.status !== 'inactive' && !module.preinstalled) return;
        
        set((state) => ({
          modules: state.modules.map((m) =>
            m.id === id ? { ...m, status: 'active' as ModuleStatus } : m
          ),
        }));
      },

      deactivateModule: (id) => {
        const module = get().getModule(id);
        if (!module || module.status !== 'active') return;
        
        set((state) => ({
          modules: state.modules.map((m) =>
            m.id === id ? { ...m, status: 'inactive' as ModuleStatus } : m
          ),
        }));
      },

      updateModuleStatus: (id, status, progress) => {
        set((state) => ({
          modules: state.modules.map((m) =>
            m.id === id ? { ...m, status, downloadProgress: progress } : m
          ),
        }));
      },

      // Getters
      getModule: (id) => get().modules.find((m) => m.id === id),
      
      getPreinstalledModules: () => get().modules.filter((m) => m.preinstalled),
      
      getInstalledModules: () => 
        get().modules.filter((m) => 
          m.preinstalled || m.status === 'active' || m.status === 'inactive'
        ),
      
      getActiveModules: () => get().modules.filter((m) => m.status === 'active'),
      
      getAvailableModules: () => get().modules.filter((m) => m.status === 'available'),
      
      getFreeModules: () => get().modules.filter((m) => m.price === 'free'),
      
      getPremiumModules: () => get().modules.filter((m) => m.price === 'premium'),
      
      isModuleActive: (id) => get().getModule(id)?.status === 'active',
      
      isModuleInstalled: (id) => {
        const module = get().getModule(id);
        return module?.preinstalled || module?.status === 'active' || module?.status === 'inactive';
      },

      // Search
      searchModules: (query) => {
        const lowerQuery = query.toLowerCase();
        return get().modules.filter((m) =>
          m.name.toLowerCase().includes(lowerQuery) ||
          m.description.toLowerCase().includes(lowerQuery) ||
          m.tags.some((t) => t.toLowerCase().includes(lowerQuery))
        );
      },

      getModulesByTag: (tag) => 
        get().modules.filter((m) => m.tags.includes(tag.toLowerCase())),
    }),
    {
      name: 'ars-technicai-modules',
      version: 1,
      partialize: (state) => ({
        // Only persist module status changes, not the full module definitions
        modules: state.modules.map((m) => ({
          id: m.id,
          status: m.status,
          installedAt: m.installedAt,
        })),
      }),
      merge: (persistedState, currentState) => {
        // Defensively handle malformed persisted state
        if (!persistedState || typeof persistedState !== 'object') {
          return currentState;
        }
        
        const persisted = persistedState as Record<string, unknown>;
        const persistedModules = Array.isArray(persisted.modules) ? persisted.modules : [];
        
        // Merge persisted status into current modules
        const mergedModules = currentState.modules.map((m) => {
          const saved = persistedModules.find(
            (pm: Record<string, unknown>) => typeof pm === 'object' && pm !== null && pm.id === m.id
          );
          if (saved && !m.preinstalled && typeof saved.status === 'string') {
            return { ...m, status: saved.status as ModuleStatus, installedAt: saved.installedAt as number | undefined };
          }
          return m;
        });
        
        return { ...currentState, modules: mergedModules };
      },
    }
  )
);
