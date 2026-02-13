// ============================================================
// ARS TECHNICAI - Core Type Definitions
// ============================================================

// ------------------------------------------------------------
// Base Types
// ------------------------------------------------------------
export type UUID = string;
export type Timestamp = number;
export type FilePath = string;

// ------------------------------------------------------------
// Asset Types
// ------------------------------------------------------------
export type AssetType = 'image' | 'video' | 'audio' | 'text' | 'prompt' | 'folder';

export interface Asset {
  id: UUID;
  name: string;
  type: AssetType;
  path: FilePath;
  size?: number;
  createdAt: Timestamp;
  modifiedAt: Timestamp;
  thumbnail?: string;
  metadata?: AssetMetadata;
}

export interface AssetMetadata {
  width?: number;
  height?: number;
  duration?: number;
  mimeType?: string;
  prompt?: string;
  model?: string;
  seed?: number;
  parentId?: UUID;
  promptId?: UUID;
  lineageId?: UUID;
  version?: string;
  parentAssetId?: UUID;
}

export interface ImageAsset extends Asset {
  type: 'image';
  width: number;
  height: number;
  dataUrl?: string;
}

// ------------------------------------------------------------
// Canvas Types
// ------------------------------------------------------------
export interface CanvasItem {
  id: UUID;
  assetId?: UUID;
  type: 'image' | 'generated' | 'placeholder';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  zIndex: number;
  locked: boolean;
  visible: boolean;
  src?: string;
  prompt?: string;
  name: string;
  promptId?: UUID;
  lineageId?: UUID;
  version?: string;
  parentAssetId?: UUID;
  createdAt: Timestamp;
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

// ------------------------------------------------------------
// Generation Types
// ------------------------------------------------------------
export interface GenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  model: string;
  seed?: number;
  steps?: number;
  guidanceScale?: number;
  referenceImages?: string[];
}

export interface GenerationResult {
  id: UUID;
  prompt: string;
  imageUrl: string;
  dataUrl?: string;
  width: number;
  height: number;
  model: string;
  seed: number;
  createdAt: Timestamp;
}

export interface GenerationJob {
  id: UUID;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  request: GenerationRequest;
  result?: GenerationResult;
  error?: string;
  progress: number;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

// ------------------------------------------------------------
// Action Log Types
// ------------------------------------------------------------
export type ActionType =
  | 'file_import'
  | 'file_export'
  | 'canvas_add'
  | 'canvas_remove'
  | 'canvas_move'
  | 'canvas_resize'
  | 'generation_start'
  | 'generation_complete'
  | 'generation_fail'
  | 'prompt_save'
  | 'settings_change'
  | 'search'
  | 'folder_create'
  | 'folder_open';

export interface ActionLogEntry {
  id: UUID;
  type: ActionType;
  timestamp: Timestamp;
  description: string;
  data?: Record<string, unknown>;
  undoable: boolean;
}

// ------------------------------------------------------------
// Settings Types
// ------------------------------------------------------------
export interface AIProviderSettings {
  provider: 'nanobanana' | 'midjourney' | 'stability' | 'openai' | 'custom';
  apiKey: string;
  endpoint?: string;
  model: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultSteps: number;
  defaultGuidanceScale: number;
}

export interface AppearanceSettings {
  fontSize: 'small' | 'medium' | 'large';
  fontScale: number; // 0.875 | 1 | 1.125
  compactMode: boolean;
  showFilenames: boolean;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  appearance: AppearanceSettings;
  aiProvider: AIProviderSettings;
  outputDirectory: string;
  autoSavePrompts: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  recentPaths: string[];
}

// ------------------------------------------------------------
// File System Types (for Explorer)
// ------------------------------------------------------------
export interface FileNode {
  id: UUID;
  name: string;
  type: 'file' | 'folder';
  path: FilePath;
  children?: FileNode[];
  expanded?: boolean;
  asset?: Asset;
}

// ------------------------------------------------------------
// Search Types
// ------------------------------------------------------------
export type SearchScope = 'files' | 'google' | 'all';

export interface SearchResult {
  id: UUID;
  title: string;
  description?: string;
  thumbnail?: string;
  url?: string;
  type: 'file' | 'web';
  asset?: Asset;
}

// ------------------------------------------------------------
// UI State Types
// ------------------------------------------------------------
export interface PanelState {
  visible: boolean;
  width: number;
  collapsed: boolean;
}

export interface WorkspaceLayout {
  explorer: PanelState;
  inspector: PanelState;
  timeline: PanelState;
}

export type WorkspaceMode = 'create' | 'rework' | 'composite' | 'timeline';

// ------------------------------------------------------------
// Dashboard Types (re-exported)
// ------------------------------------------------------------
export * from './dashboard';
