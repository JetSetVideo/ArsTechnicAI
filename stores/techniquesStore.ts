/**
 * Techniques Store
 * 
 * Manages the catalog of AI-powered techniques organized by category.
 * The catalog is static but user favorites are persisted.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Technique, TechniqueCategory, TechniquesCatalog } from '../types/dashboard';

// ============================================
// TECHNIQUES CATALOG
// ============================================

const TECHNIQUES_CATALOG: TechniquesCatalog = {
  image: [
    { id: 'upscale', name: 'Upscale 4K/8K', description: 'Increase resolution with AI enhancement', category: 'image', supportedAssets: ['image'], requiredModule: 'image-enhance', tags: ['upscale', 'resolution', 'enhance'], featured: true },
    { id: 'denoise', name: 'Denoise', description: 'Remove noise while preserving detail', category: 'image', supportedAssets: ['image', 'video'], requiredModule: 'image-enhance', tags: ['denoise', 'clean', 'enhance'] },
    { id: 'color-grade', name: 'Color Grade', description: 'Cinematic color correction and grading', category: 'image', supportedAssets: ['image', 'video'], requiredModule: 'image-enhance', tags: ['color', 'grading', 'cinematic'], featured: true },
    { id: 'style-transfer', name: 'Style Transfer', description: 'Apply artistic styles (oil paint, anime, etc.)', category: 'image', supportedAssets: ['image'], requiredModule: 'style-pro', tags: ['style', 'artistic', 'transfer'], featured: true },
    { id: 'bg-remove', name: 'Background Remove', description: 'Extract subject from background', category: 'image', supportedAssets: ['image'], requiredModule: 'bg-replace', tags: ['background', 'remove', 'extract'] },
    { id: 'obj-remove', name: 'Object Remove', description: 'Inpaint to remove unwanted objects', category: 'image', supportedAssets: ['image'], requiredModule: 'image-enhance', tags: ['object', 'remove', 'inpaint'] },
    { id: 'face-restore', name: 'Face Restore', description: 'Enhance and restore facial details', category: 'image', supportedAssets: ['image', 'video'], requiredModule: 'image-enhance', tags: ['face', 'restore', 'enhance'] },
    { id: 'hdr-convert', name: 'HDR Convert', description: 'Convert SDR to HDR', category: 'image', supportedAssets: ['image', 'video'], requiredModule: 'image-enhance', tags: ['hdr', 'dynamic-range', 'convert'] },
    { id: 'age-transform', name: 'Age Transform', description: 'Change apparent age of characters', category: 'image', supportedAssets: ['image', 'video'], requiredModule: 'image-gen', tags: ['age', 'transform', 'face'], featured: true },
    { id: 'era-shift', name: 'Era Shift', description: 'Convert modern to vintage or vice versa', category: 'image', supportedAssets: ['image'], requiredModule: 'style-pro', tags: ['era', 'vintage', 'modern'] },
    { id: 'weather-change', name: 'Weather Change', description: 'Add rain, snow, fog, or sunshine', category: 'image', supportedAssets: ['image', 'video'], requiredModule: 'image-gen', tags: ['weather', 'rain', 'snow', 'fog'] },
    { id: 'time-of-day', name: 'Time of Day', description: 'Shift from day to night or reverse', category: 'image', supportedAssets: ['image'], requiredModule: 'image-gen', tags: ['time', 'day', 'night'] },
    { id: 'season-change', name: 'Season Change', description: 'Transform spring to winter, etc.', category: 'image', supportedAssets: ['image'], requiredModule: 'image-gen', tags: ['season', 'spring', 'winter'] },
    { id: 'brand-replace', name: 'Brand Replace', description: 'Replace or remove product brands', category: 'image', supportedAssets: ['image', 'video'], requiredModule: 'image-gen', tags: ['brand', 'replace', 'remove'] },
  ],
  video: [
    { id: 'frame-interpolate', name: 'Frame Interpolate', description: 'Create slow motion via AI-generated frames', category: 'video', supportedAssets: ['video'], requiredModule: 'video-edit', tags: ['interpolation', 'slow-motion', 'frames'], featured: true },
    { id: 'video-upscale', name: 'Video Upscale', description: 'Increase video resolution', category: 'video', supportedAssets: ['video'], requiredModule: 'image-enhance', tags: ['upscale', 'resolution', 'video'] },
    { id: 'stabilize', name: 'Stabilize', description: 'Remove camera shake', category: 'video', supportedAssets: ['video'], requiredModule: 'video-edit', tags: ['stabilize', 'shake', 'smooth'] },
    { id: 'speed-ramp', name: 'Speed Ramp', description: 'Create smooth speed transitions', category: 'video', supportedAssets: ['video'], requiredModule: 'video-edit', tags: ['speed', 'ramp', 'transition'] },
    { id: 'motion-blur-add', name: 'Motion Blur Add', description: 'Add cinematic motion blur', category: 'video', supportedAssets: ['video'], requiredModule: 'video-edit', tags: ['motion', 'blur', 'cinematic'] },
    { id: 'motion-blur-remove', name: 'Motion Blur Remove', description: 'Sharpen fast motion', category: 'video', supportedAssets: ['video'], requiredModule: 'video-edit', tags: ['motion', 'blur', 'sharpen'] },
    { id: 'object-track', name: 'Object Track', description: 'Track objects across frames', category: 'video', supportedAssets: ['video'], requiredModule: 'obj-track', tags: ['track', 'object', 'follow'], featured: true },
    { id: 'rotoscope', name: 'Rotoscope', description: 'Automatic mask extraction', category: 'video', supportedAssets: ['video'], requiredModule: 'obj-track', tags: ['rotoscope', 'mask', 'extract'] },
    { id: 'scene-extend', name: 'Scene Extend', description: 'Generate additional frames to extend scenes', category: 'video', supportedAssets: ['video'], requiredModule: 'video-edit', tags: ['extend', 'generate', 'frames'] },
    { id: 'loop-create', name: 'Loop Create', description: 'Create seamless video loops', category: 'video', supportedAssets: ['video'], requiredModule: 'video-edit', tags: ['loop', 'seamless', 'repeat'] },
  ],
  '3d': [
    { id: 'depth-estimate', name: 'Depth Estimate', description: 'Generate depth maps from images', category: '3d', supportedAssets: ['image', 'video'], requiredModule: 'camera-move', tags: ['depth', 'map', '3d'], featured: true },
    { id: 'novel-view', name: 'Novel View', description: 'Generate new camera angles', category: '3d', supportedAssets: ['image', '3d'], requiredModule: 'camera-move', tags: ['view', 'camera', 'angle'], featured: true },
    { id: '2d-to-3d', name: '2D to 3D', description: 'Convert flat image to 3D scene', category: '3d', supportedAssets: ['image'], requiredModule: '3d-scene', tags: ['convert', '2d', '3d'] },
    { id: 'point-cloud', name: 'Point Cloud', description: 'Generate 3D point clouds', category: '3d', supportedAssets: ['image', 'video'], requiredModule: '3d-scene', tags: ['point-cloud', '3d', 'reconstruction'] },
    { id: 'camera-orbit', name: 'Camera Orbit', description: 'Create orbiting camera motion', category: '3d', supportedAssets: ['image', '3d'], requiredModule: 'camera-move', tags: ['orbit', 'camera', 'rotation'] },
    { id: 'parallax-create', name: 'Parallax Create', description: 'Add 3D parallax effect to images', category: '3d', supportedAssets: ['image'], requiredModule: 'camera-move', tags: ['parallax', '3d', 'depth'] },
    { id: 'env-map', name: 'Environment Map', description: 'Generate 360 environments', category: '3d', supportedAssets: ['image'], requiredModule: '3d-scene', tags: ['environment', '360', 'panorama'] },
    { id: 'mesh-generate', name: 'Mesh Generate', description: 'Create 3D meshes from images', category: '3d', supportedAssets: ['image'], requiredModule: '3d-scene', tags: ['mesh', '3d', 'model'] },
  ],
  audio: [
    { id: 'voice-clone', name: 'Voice Clone', description: 'Clone voice from samples', category: 'audio', supportedAssets: ['audio'], requiredModule: 'voice-clone', tags: ['voice', 'clone', 'synthesis'], featured: true },
    { id: 'voice-convert', name: 'Voice Convert', description: 'Change voice characteristics', category: 'audio', supportedAssets: ['audio'], requiredModule: 'voice-clone', tags: ['voice', 'convert', 'transform'] },
    { id: 'music-generate', name: 'Music Generate', description: 'Create background music', category: 'audio', supportedAssets: ['audio'], requiredModule: 'music-compose', tags: ['music', 'generate', 'compose'], featured: true },
    { id: 'sfx-generate', name: 'SFX Generate', description: 'Generate sound effects', category: 'audio', supportedAssets: ['audio'], requiredModule: 'audio-proc', tags: ['sfx', 'sound', 'effects'] },
    { id: 'noise-reduce', name: 'Noise Reduce', description: 'Remove background noise', category: 'audio', supportedAssets: ['audio'], requiredModule: 'audio-proc', tags: ['noise', 'reduce', 'clean'] },
    { id: 'speech-to-text', name: 'Speech to Text', description: 'Transcribe audio to text', category: 'audio', supportedAssets: ['audio'], requiredModule: 'audio-proc', tags: ['speech', 'transcribe', 'text'] },
    { id: 'text-to-speech', name: 'Text to Speech', description: 'Generate speech from text', category: 'audio', supportedAssets: ['text'], requiredModule: 'voice-clone', tags: ['tts', 'speech', 'voice'] },
    { id: 'lip-sync', name: 'Lip Sync', description: 'Match audio to lip movement', category: 'audio', supportedAssets: ['video', 'audio'], requiredModule: 'lip-sync', tags: ['lip', 'sync', 'audio-visual'] },
    { id: 'audio-separate', name: 'Audio Separate', description: 'Split vocals and instruments', category: 'audio', supportedAssets: ['audio'], requiredModule: 'audio-proc', tags: ['separate', 'stems', 'vocals'] },
    { id: 'audio-enhance', name: 'Audio Enhance', description: 'Improve overall audio quality', category: 'audio', supportedAssets: ['audio'], requiredModule: 'audio-proc', tags: ['enhance', 'quality', 'improve'] },
  ],
  text: [
    { id: 'script-expand', name: 'Script Expand', description: 'Expand brief into full script', category: 'text', supportedAssets: ['text', 'script'], requiredModule: 'asset-mgr', tags: ['script', 'expand', 'write'] },
    { id: 'dialogue-generate', name: 'Dialogue Generate', description: 'Create character dialogue', category: 'text', supportedAssets: ['text', 'script'], requiredModule: 'asset-mgr', tags: ['dialogue', 'character', 'write'] },
    { id: 'translate', name: 'Translate', description: 'AI-powered translation', category: 'text', supportedAssets: ['text', 'audio'], requiredModule: 'asset-mgr', tags: ['translate', 'language', 'localize'] },
    { id: 'summarize', name: 'Summarize', description: 'Condense long content', category: 'text', supportedAssets: ['text', 'video'], requiredModule: 'asset-mgr', tags: ['summarize', 'condense', 'brief'] },
    { id: 'describe-scene', name: 'Describe Scene', description: 'Generate scene descriptions', category: 'text', supportedAssets: ['image', 'video'], requiredModule: 'asset-mgr', tags: ['describe', 'scene', 'caption'] },
    { id: 'extract-text', name: 'Extract Text', description: 'OCR from images', category: 'text', supportedAssets: ['image'], requiredModule: 'asset-mgr', tags: ['ocr', 'extract', 'text'] },
    { id: 'sentiment-analyze', name: 'Sentiment Analyze', description: 'Analyze emotional tone', category: 'text', supportedAssets: ['text', 'audio'], requiredModule: 'asset-mgr', tags: ['sentiment', 'emotion', 'analyze'] },
  ],
  analysis: [
    { id: 'object-detect', name: 'Object Detect', description: 'Identify objects in scene', category: 'analysis', supportedAssets: ['image', 'video'], requiredModule: 'asset-mgr', tags: ['detect', 'object', 'identify'] },
    { id: 'face-recognize', name: 'Face Recognize', description: 'Identify and tag faces', category: 'analysis', supportedAssets: ['image', 'video'], requiredModule: 'image-enhance', tags: ['face', 'recognize', 'tag'] },
    { id: 'emotion-detect', name: 'Emotion Detect', description: 'Analyze facial emotions', category: 'analysis', supportedAssets: ['image', 'video'], requiredModule: 'image-enhance', tags: ['emotion', 'face', 'analyze'] },
    { id: 'action-recognize', name: 'Action Recognize', description: 'Identify actions and activities', category: 'analysis', supportedAssets: ['video'], requiredModule: 'video-edit', tags: ['action', 'activity', 'recognize'] },
    { id: 'scene-classify', name: 'Scene Classify', description: 'Categorize scene type', category: 'analysis', supportedAssets: ['image', 'video'], requiredModule: 'asset-mgr', tags: ['scene', 'classify', 'category'] },
    { id: 'quality-assess', name: 'Quality Assess', description: 'Evaluate image/video quality', category: 'analysis', supportedAssets: ['image', 'video'], requiredModule: 'asset-mgr', tags: ['quality', 'assess', 'evaluate'] },
    { id: 'content-moderate', name: 'Content Moderate', description: 'Flag inappropriate content', category: 'analysis', supportedAssets: ['image', 'video', 'text'], requiredModule: 'asset-mgr', tags: ['moderate', 'safety', 'flag'] },
  ],
};

// Flatten catalog for easier access
const ALL_TECHNIQUES: Technique[] = Object.values(TECHNIQUES_CATALOG).flat();

// ============================================
// STORE INTERFACE
// ============================================

interface TechniquesState {
  favorites: string[];
  recentlyUsed: string[];
  usageCounts: Record<string, number>;
}

interface TechniquesActions {
  // Favorites
  addFavorite: (id: string) => void;
  removeFavorite: (id: string) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  
  // Usage tracking
  recordUsage: (id: string) => void;
  getUsageCount: (id: string) => number;
  
  // Getters
  getTechnique: (id: string) => Technique | undefined;
  getAllTechniques: () => Technique[];
  getTechniquesByCategory: (category: TechniqueCategory) => Technique[];
  getFeaturedTechniques: () => Technique[];
  getFavoriteTechniques: () => Technique[];
  getRecentlyUsedTechniques: (limit?: number) => Technique[];
  getMostUsedTechniques: (limit?: number) => Technique[];
  
  // Search
  searchTechniques: (query: string) => Technique[];
  getTechniquesByModule: (moduleId: string) => Technique[];
  getTechniquesByAssetType: (assetType: string) => Technique[];
  
  // Catalog access
  getCatalog: () => TechniquesCatalog;
  getCategories: () => TechniqueCategory[];
}

type TechniquesStore = TechniquesState & TechniquesActions;

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useTechniquesStore = create<TechniquesStore>()(
  persist(
    (set, get) => ({
      // Initial state
      favorites: [],
      recentlyUsed: [],
      usageCounts: {},

      // Favorites
      addFavorite: (id) => {
        if (!get().favorites.includes(id)) {
          set((state) => ({ favorites: [...state.favorites, id] }));
        }
      },

      removeFavorite: (id) => {
        set((state) => ({ favorites: state.favorites.filter((f) => f !== id) }));
      },

      toggleFavorite: (id) => {
        if (get().favorites.includes(id)) {
          get().removeFavorite(id);
        } else {
          get().addFavorite(id);
        }
      },

      isFavorite: (id) => get().favorites.includes(id),

      // Usage tracking
      recordUsage: (id) => {
        set((state) => {
          const recentlyUsed = [id, ...state.recentlyUsed.filter((r) => r !== id)].slice(0, 20);
          const usageCounts = {
            ...state.usageCounts,
            [id]: (state.usageCounts[id] || 0) + 1,
          };
          return { recentlyUsed, usageCounts };
        });
      },

      getUsageCount: (id) => get().usageCounts[id] || 0,

      // Getters
      getTechnique: (id) => ALL_TECHNIQUES.find((t) => t.id === id),

      getAllTechniques: () => ALL_TECHNIQUES,

      getTechniquesByCategory: (category) => TECHNIQUES_CATALOG[category] || [],

      getFeaturedTechniques: () => ALL_TECHNIQUES.filter((t) => t.featured),

      getFavoriteTechniques: () => {
        const { favorites } = get();
        return ALL_TECHNIQUES.filter((t) => favorites.includes(t.id));
      },

      getRecentlyUsedTechniques: (limit = 10) => {
        const { recentlyUsed } = get();
        return recentlyUsed
          .map((id) => ALL_TECHNIQUES.find((t) => t.id === id))
          .filter((t): t is Technique => t !== undefined)
          .slice(0, limit);
      },

      getMostUsedTechniques: (limit = 10) => {
        const { usageCounts } = get();
        return ALL_TECHNIQUES
          .filter((t) => usageCounts[t.id] > 0)
          .sort((a, b) => (usageCounts[b.id] || 0) - (usageCounts[a.id] || 0))
          .slice(0, limit);
      },

      // Search
      searchTechniques: (query) => {
        const lowerQuery = query.toLowerCase();
        return ALL_TECHNIQUES.filter((t) =>
          t.name.toLowerCase().includes(lowerQuery) ||
          t.description.toLowerCase().includes(lowerQuery) ||
          t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
        );
      },

      getTechniquesByModule: (moduleId) =>
        ALL_TECHNIQUES.filter((t) => t.requiredModule === moduleId),

      getTechniquesByAssetType: (assetType: string) =>
        ALL_TECHNIQUES.filter((t) => 
          (t.supportedAssets as readonly string[]).includes(assetType)
        ),

      // Catalog access
      getCatalog: () => TECHNIQUES_CATALOG,
      getCategories: () => Object.keys(TECHNIQUES_CATALOG) as TechniqueCategory[],
    }),
    {
      name: 'ars-technicai-techniques',
      version: 1,
      // Only persist user data, not the catalog
      partialize: (state) => ({
        favorites: state.favorites,
        recentlyUsed: state.recentlyUsed,
        usageCounts: state.usageCounts,
      }),
    }
  )
);
