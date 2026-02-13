/**
 * Dashboard Types
 * 
 * Type definitions for the dashboard system including:
 * - Modules (Blender/ComfyUI-style extensible capabilities)
 * - Techniques (AI-powered processes)
 * - Agents (autonomous/semi-autonomous task executors)
 * - User Profile (preference learning and avatar generation)
 * - Shop items
 * - Social media integration
 */

import type { UUID, Timestamp } from './index';

// ============================================
// MODULE SYSTEM TYPES
// ============================================

export type ModuleStatus = 'active' | 'inactive' | 'available' | 'downloading' | 'error';
export type ModulePrice = 'free' | 'premium' | 'subscription';

export interface Module {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: ModuleStatus;
  preinstalled: boolean;
  price: ModulePrice;
  version: string;
  requiredModels?: string[];
  tags: string[];
  downloadProgress?: number;
  installedAt?: Timestamp;
}

// ============================================
// TECHNIQUE TYPES
// ============================================

export type TechniqueCategory = 'image' | 'video' | '3d' | 'audio' | 'text' | 'analysis';
export type AssetTypeForTechnique = 'image' | 'video' | 'audio' | 'text' | '3d' | 'script' | 'color' | 'location';

export interface Technique {
  id: string;
  name: string;
  description: string;
  category: TechniqueCategory;
  supportedAssets: AssetTypeForTechnique[];
  requiredModule: string;
  tags: string[];
  featured?: boolean;
  usageCount?: number;
}

// ============================================
// AGENT TYPES
// ============================================

export type AgentMode = 'automatic' | 'semi-automatic' | 'interactive';
export type AgentStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';
export type AgentSource = 'prebuilt' | 'user-created' | 'shop';

export interface AgentTask {
  id: string;
  name: string;
  moduleId: string;
  techniqueId?: string;
  config: Record<string, unknown>;
  requiresInput: boolean;
  inputPrompt?: string;
  order: number;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  icon: string;
  mode: AgentMode;
  source: AgentSource;
  status: AgentStatus;
  tasks: AgentTask[];
  requiredModules: string[];
  tags: string[];
  price?: number;
  currency?: 'credits' | 'usd';
  author?: string;
  rating?: number;
  usageCount?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AgentExecution {
  id: string;
  agentId: string;
  status: AgentStatus;
  currentTaskIndex: number;
  progress: number;
  startedAt: Timestamp;
  completedAt?: Timestamp;
  results: Record<string, unknown>[];
  error?: string;
  inputs: Record<string, unknown>;
}

// ============================================
// USER PROFILE TYPES
// ============================================

export interface PreferenceScores {
  visualStyle: { realistic: number; stylized: number };
  colorTemp: { warm: number; cool: number };
  saturation: { vivid: number; muted: number };
  composition: { centered: number; dynamic: number };
  detail: { minimal: number; rich: number };
  mood: { dramatic: number; calm: number };
  era: { modern: number; vintage: number };
}

export type PreferenceCategory = keyof PreferenceScores;

export interface PreferenceOption {
  imageUrl: string;
  tags: string[];
  weight: Partial<Record<PreferenceCategory, { key: string; value: number }>>;
}

export interface PreferenceChoice {
  id: string;
  category: PreferenceCategory;
  optionA: PreferenceOption;
  optionB: PreferenceOption;
  selected: 'A' | 'B';
  timestamp: Timestamp;
  sessionId: string;
}

export interface UserAvatar {
  imageUrl: string;
  style: string;
  generatedAt: Timestamp;
  seed?: string;
  preferences: Partial<PreferenceScores>;
}

export interface UserProfile {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  displayName?: string;
  email?: string;
  preferences: PreferenceScores;
  avatar: UserAvatar | null;
  choiceHistory: PreferenceChoice[];
  styleTags: string[];
  preferenceGatheringProgress: number; // 0-100
  consentGiven: boolean;
  consentTimestamp?: Timestamp;
}

// ============================================
// SHOP TYPES
// ============================================

export type ShopItemType = 'module' | 'agent' | 'neural_network' | 'asset_pack' | 'template' | 'credits';
export type ShopCategory = 'featured' | 'new' | 'popular' | 'free' | 'premium';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  type: ShopItemType;
  price: number;
  currency: 'credits' | 'usd';
  thumbnail: string;
  tags: string[];
  rating?: number;
  downloadCount?: number;
  author?: string;
  category?: ShopCategory;
  relatedItems?: string[];
}

// ============================================
// SOCIAL MEDIA TYPES
// ============================================

export type SocialPlatform = 'tiktok' | 'x' | 'instagram' | 'youtube' | 'email';
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

export interface PostEngagement {
  likes: number;
  comments: number;
  shares: number;
  views?: number;
}

export interface SocialPost {
  id: string;
  platform: SocialPlatform;
  content: string;
  mediaUrls: string[];
  status: PostStatus;
  scheduledAt?: Timestamp;
  publishedAt?: Timestamp;
  engagement?: PostEngagement;
  projectId?: string;
  error?: string;
}

export interface SocialConnection {
  platform: SocialPlatform;
  connected: boolean;
  username?: string;
  avatar?: string;
  connectedAt?: Timestamp;
  accessToken?: string; // Note: In production, store securely on backend
}

// ============================================
// PROJECT TYPES (enhanced for dashboard)
// ============================================

export interface DashboardProject {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  createdAt: Timestamp;
  modifiedAt: Timestamp;
  assetCount: number;
  tags: string[];
  agentsUsed?: string[];
  isFavorite?: boolean;
  lastOpenedAt?: Timestamp;
}

// ============================================
// SHARED ASSET TYPES
// ============================================

export type SharedAssetCategory = 
  | 'scripts' 
  | 'images' 
  | 'colors' 
  | '3d-models' 
  | 'historical' 
  | 'locations' 
  | 'characters' 
  | 'audio';

export interface SharedAsset {
  id: string;
  name: string;
  type: AssetTypeForTechnique;
  category: SharedAssetCategory;
  thumbnail?: string;
  projectIds: string[]; // projects using this asset
  createdAt: Timestamp;
  tags: string[];
  fileSize?: number;
  mimeType?: string;
}

// ============================================
// SEARCH TYPES
// ============================================

export type SearchEntityType = 'project' | 'module' | 'technique' | 'agent' | 'asset' | 'shop_item';

export interface SearchableEntity {
  type: SearchEntityType;
  id: string;
  title: string;
  description: string;
  tags: string[];
  category?: string;
  thumbnail?: string;
  relevanceScore?: number;
}

export interface SearchState {
  query: string;
  results: SearchableEntity[];
  isSearching: boolean;
  filters: {
    types: SearchEntityType[];
    categories: string[];
  };
}

// ============================================
// DASHBOARD TAB TYPES
// ============================================

export type DashboardTab = 'projects' | 'ai-tools' | 'agents' | 'profile' | 'social';

export interface DashboardState {
  activeTab: DashboardTab;
  isLoading: boolean;
  error: string | null;
}

// ============================================
// PREBUILT DATA TYPES
// ============================================

export interface PrebuiltModulesData {
  preinstalled: Module[];
  available: Module[];
}

export interface PrebuiltAgentsData {
  prebuilt: Agent[];
  shopFeatured: Agent[];
}

export interface TechniquesCatalog {
  image: Technique[];
  video: Technique[];
  '3d': Technique[];
  audio: Technique[];
  text: Technique[];
  analysis: Technique[];
}
