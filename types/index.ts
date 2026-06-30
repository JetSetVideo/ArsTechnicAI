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
export type AssetType = 'image' | 'video' | 'audio' | 'text' | 'prompt' | 'folder' | 'model_3d' | 'splat' | 'waveform' | 'filmstrip';

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
  negativePrompt?: string;
  model?: string;
  seed?: number;
  parentId?: UUID;
  promptId?: UUID;
  lineageId?: UUID;
  version?: string;
  parentAssetId?: UUID;
  localPath?: string;
  isReference?: boolean;
  fileSize?: number;
  codec?: string;
  fps?: number;
  channels?: number;
  sampleRate?: number;
  bitRate?: number;
  importedAt?: Timestamp;
  projectIds?: UUID[];
  usageCount?: number;
  variationIds?: UUID[];
  childAssetIds?: UUID[];
  source?: 'imported' | 'generated' | 'duplicated' | 'modified';
  lastUsedAt?: Timestamp;
  templateId?: UUID;
  templateCategory?: string;
  templateUsageCount?: number;
  templateDownloads?: number;
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
export interface GenerationMeta {
  prompt: string;
  negativePrompt?: string;
  model: string;
  seed: number;
  width: number;
  height: number;
  generatedAt: Timestamp;
  filePath?: string;
  parentIds?: UUID[];
  childIds?: UUID[];
  imageVersion?: number;
  variations?: { id: UUID; label: string; filePath?: string }[];
}

export interface CanvasItem {
  id: UUID;
  assetId?: UUID;
  type: 'image' | 'generated' | 'placeholder' | 'video' | 'audio' | 'text' | 'template';
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
  updatedAt?: Timestamp;
  generationMeta?: GenerationMeta;
  mediaMeta?: MediaMeta;
  groupId?: string;
  groupOrbit?: boolean;
}

export interface MediaMeta {
  mimeType?: string;
  fileSize?: number;
  duration?: number;
  fps?: number;
  codec?: string;
  bitRate?: number;
  channels?: number;
  sampleRate?: number;
  filmstripFrames?: string[];
  source?: 'imported' | 'generated' | 'duplicated' | 'modified';
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
export type AIProviderID =
  | 'GOOGLE_IMAGEN'
  | 'OPENAI_DALLE'
  | 'STABILITY'
  | 'FAL'
  | 'REPLICATE'
  | 'MIDJOURNEY'
  | 'CUSTOM';

export interface AIProviderSettings {
  // Legacy single-provider fields (kept for migration compatibility)
  provider?: string;
  apiKey?: string;
  endpoint?: string;
  model?: string;
  // New multi-provider fields
  activeProvider: AIProviderID;
  activeModel: string;
  apiKeys: Partial<Record<AIProviderID, string>>;
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
  groupingDelay?: number;
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

export type WorkspaceMode = 'creation' | 'composite' | 'timeline';
// Legacy aliases for backward compatibility (create/rework merged into 'creation')
export type LegacyWorkspaceMode = 'create' | 'rework' | 'composite' | 'timeline';

// ------------------------------------------------------------
// Depth & Spatial Types — 3D layering
// ------------------------------------------------------------
export interface DepthLayer {
  z: number;           // absolute z-index
  depth: number;       // normalized 0 (background) → 1 (foreground)
  layer: 'backdrop' | 'midground' | 'foreground' | 'overlay';
}

// ------------------------------------------------------------
// Time & Temporal Types
// ------------------------------------------------------------
export interface TimeKeyframe {
  id: UUID;
  time: number;          // seconds from start
  duration: number;      // duration of this keyframe segment
  properties: Record<string, number | string | boolean>;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce';
}

export interface TimeFactor {
  scale: number;         // 1 = real-time, 0.5 = half-speed, 2 = double-speed
  loop: boolean;
  loopCount: number;     // 0 = infinite
  startOffset: number;   // seconds
}

// ------------------------------------------------------------
// Transition Types
// ------------------------------------------------------------
export type TransitionType =
  | 'fade' | 'dissolve' | 'wipe-left' | 'wipe-right' | 'wipe-up' | 'wipe-down'
  | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down'
  | 'zoom-in' | 'zoom-out' | 'rotate' | 'flip' | 'cube'
  | 'glitch' | 'pixelate' | 'blur' | 'none';

export interface Transition {
  id: UUID;
  type: TransitionType;
  fromSceneId: UUID;
  toSceneId: UUID;
  duration: number;       // seconds
  easing: string;
  overlayColor?: string;
  parameters?: Record<string, number>;
}

// ------------------------------------------------------------
// Scene Types
// ------------------------------------------------------------
export interface Scene {
  id: UUID;
  name: string;
  order: number;
  startTime: number;     // seconds in timeline
  endTime: number;
  items: UUID[];         // canvas item IDs in this scene
  transitions: Transition[];
  backgroundColor?: string;
  notes?: string;
}

// ------------------------------------------------------------
// Character Consistency Types
// ------------------------------------------------------------
export interface CharacterProfile {
  id: UUID;
  name: string;
  description: string;
  age?: string;
  gender?: string;
  appearance: string;    // detailed visual description
  outfit?: string;
  accessories?: string[];
  referenceImages: string[];  // UUIDs of reference assets
  styleConsistency: number;   // 0-1 score
  generatedAt?: Timestamp;
  lastUsedAt?: Timestamp;
}

export interface CharacterConsistencyCheck {
  characterId: UUID;
  generatedImageId: UUID;
  similarityScore: number;   // 0-1
  issues: string[];          // e.g. "hair color mismatch", "different face shape"
  passed: boolean;
}

// ------------------------------------------------------------
// Prompt Generation Types
// ------------------------------------------------------------
export interface PromptTemplate {
  id: UUID;
  name: string;
  category: 'character' | 'scene' | 'object' | 'style' | 'mood' | 'action';
  template: string;          // with {placeholders}
  variables: PromptVariable[];
  usageCount: number;
  successRate?: number;     // user feedback score
}

export interface PromptVariable {
  id: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'color' | 'style' | 'character';
  default?: string;
  options?: string[];       // for select type
  min?: number;
  max?: number;
  required: boolean;
}

export interface ImageAnalysisResult {
  detectedObjects: string[];
  detectedStyles: string[];
  colorPalette: string[];
  composition: string;
  suggestedPrompt: string;
  confidence: number;       // 0-1
}

// ------------------------------------------------------------
// Format Conversion Types
// ------------------------------------------------------------
export type FormatConversion = {
  id: UUID;
  fromFormat: string;
  toFormat: string;
  sourceAssetId: UUID;
  resultAssetId?: UUID;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  parameters?: Record<string, unknown>;
  createdAt: Timestamp;
  completedAt?: Timestamp;
};

// Re-export in index barrel
export type { FormatConversion as ConversionJob };

// ------------------------------------------------------------
// Dashboard Types (re-exported)
// ------------------------------------------------------------
export * from './dashboard';
export * from './production';
