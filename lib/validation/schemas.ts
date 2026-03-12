import { z } from 'zod';

// ============================================================
// Auth Schemas
// ============================================================

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

// ============================================================
// User Schemas
// ============================================================

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  displayName: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['SUPERADMIN', 'ADMIN', 'CREATOR', 'USER', 'VIEWER']).optional(),
  isActive: z.boolean().optional(),
});

export const userSettingsSchema = z.object({
  theme: z.string().optional(),
  autoSavePrompts: z.boolean().optional(),
  showGrid: z.boolean().optional(),
  snapToGrid: z.boolean().optional(),
  gridSize: z.number().int().min(5).max(100).optional(),
  defaultWidth: z.number().int().min(64).max(4096).optional(),
  defaultHeight: z.number().int().min(64).max(4096).optional(),
  defaultSteps: z.number().int().min(1).max(150).optional(),
  defaultGuidanceScale: z.number().min(1).max(30).optional(),
  defaultProvider: z.enum(['GOOGLE_IMAGEN', 'OPENAI_DALLE', 'STABILITY', 'MIDJOURNEY', 'REPLICATE', 'CUSTOM']).optional(),
  defaultModel: z.string().optional(),
});

export const createApiKeySchema = z.object({
  provider: z.enum(['GOOGLE_IMAGEN', 'OPENAI_DALLE', 'STABILITY', 'MIDJOURNEY', 'REPLICATE', 'CUSTOM']),
  key: z.string().min(1),
  label: z.string().max(100).optional(),
});

// ============================================================
// Project Schemas
// ============================================================

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  currentMode: z.enum(['CREATE', 'REWORK', 'COMPOSITE', 'TIMELINE', 'COMIC', 'SCENE_3D']).optional(),
});

export const layoutStateSchema = z.object({
  layoutState: z.record(z.unknown()),
});

export const addMemberSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(['SUPERADMIN', 'ADMIN', 'CREATOR', 'USER', 'VIEWER']).optional(),
});

// ============================================================
// Asset Schemas
// ============================================================

export const createAssetSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'TEXT', 'PROMPT', 'FOLDER', 'VOCABULARY', 'PRESET', 'CHARACTER', 'SCENE', 'LUT']),
  projectId: z.string().cuid().optional(),
  prompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateAssetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  prompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const batchAssetSchema = z.object({
  action: z.enum(['delete', 'move', 'tag', 'untag']),
  assetIds: z.array(z.string().cuid()).min(1).max(100),
  projectId: z.string().cuid().optional(),
  tagId: z.string().cuid().optional(),
});

// ============================================================
// File Tree Schemas
// ============================================================

export const createFileNodeSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['file', 'folder']),
  parentId: z.string().cuid().optional().nullable(),
  assetId: z.string().cuid().optional().nullable(),
});

export const updateFileNodeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  parentId: z.string().cuid().optional().nullable(),
});

export const reorderFileNodesSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().cuid(),
    sortOrder: z.number().int(),
  })),
});

// ============================================================
// Canvas Schemas
// ============================================================

export const canvasItemSchema = z.object({
  assetId: z.string().cuid().optional().nullable(),
  type: z.enum(['IMAGE', 'GENERATED', 'PLACEHOLDER', 'PROMPT_NODE', 'REFERENCE_SET', 'PROVIDER_CALL', 'EDIT_NODE', 'UPSCALE_NODE', 'MERGE_NODE', 'EXPORT_NODE', 'COMMENT', 'FRAME']),
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().default(200),
  height: z.number().default(200),
  rotation: z.number().default(0),
  scale: z.number().default(1),
  zIndex: z.number().int().default(0),
  locked: z.boolean().default(false),
  visible: z.boolean().default(true),
  name: z.string().optional(),
  prompt: z.string().optional(),
  nodeData: z.record(z.unknown()).optional(),
  dataUrl: z.string().optional(),
});

export const updateCanvasItemSchema = canvasItemSchema.partial();

export const canvasEdgeSchema = z.object({
  sourceItemId: z.string().cuid(),
  targetItemId: z.string().cuid(),
  sourcePort: z.string().optional(),
  targetPort: z.string().optional(),
  dataType: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const viewportSchema = z.object({
  viewportX: z.number(),
  viewportY: z.number(),
  viewportZoom: z.number().min(0.1).max(10),
});

export const canvasBatchSchema = z.object({
  updates: z.array(z.object({
    id: z.string().cuid(),
    data: updateCanvasItemSchema,
  })),
});

// ============================================================
// Timeline Schemas
// ============================================================

export const timelineTrackSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['VIDEO', 'AUDIO', 'SUBTITLE', 'FX', 'DATA']),
  sortOrder: z.number().int().optional(),
});

export const updateTimelineTrackSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
  isMuted: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  volume: z.number().min(0).max(2).optional(),
});

export const timelineClipSchema = z.object({
  trackId: z.string().cuid(),
  assetId: z.string().cuid().optional().nullable(),
  name: z.string().optional(),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  inPoint: z.number().min(0).optional(),
  outPoint: z.number().min(0).optional(),
  opacity: z.number().min(0).max(1).optional(),
  volume: z.number().min(0).max(2).optional(),
  speed: z.number().min(0.1).max(10).optional(),
  textContent: z.string().optional(),
  textStyle: z.record(z.unknown()).optional(),
  effects: z.record(z.unknown()).optional(),
  transitions: z.record(z.unknown()).optional(),
});

export const updateTimelineClipSchema = timelineClipSchema.partial();

export const timelineMarkerSchema = z.object({
  time: z.number().min(0),
  name: z.string().optional(),
  type: z.string().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
});

// ============================================================
// Generation Schemas
// ============================================================

export const generateSchema = z.object({
  prompt: z.string().min(1).max(10000),
  negativePrompt: z.string().max(10000).optional(),
  width: z.number().int().min(64).max(4096).default(1024),
  height: z.number().int().min(64).max(4096).default(1024),
  provider: z.enum(['GOOGLE_IMAGEN', 'OPENAI_DALLE', 'STABILITY', 'MIDJOURNEY', 'REPLICATE', 'CUSTOM']).optional(),
  model: z.string().optional(),
  seed: z.number().int().optional(),
  steps: z.number().int().min(1).max(150).optional(),
  guidanceScale: z.number().min(1).max(30).optional(),
  projectId: z.string().cuid().optional(),
  priority: z.number().int().min(0).max(10).default(0),
  apiKey: z.string().optional(),
});

// ============================================================
// Prompt Schemas
// ============================================================

export const promptTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  template: z.string().min(1),
  variables: z.record(z.unknown()).optional(),
  category: z.string().optional(),
  isGlobal: z.boolean().optional(),
});

export const vocabLibrarySchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1),
  description: z.string().max(1000).optional(),
  entries: z.record(z.unknown()),
  projectId: z.string().cuid().optional(),
  isGlobal: z.boolean().optional(),
});

// ============================================================
// Tag Schemas
// ============================================================

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

// ============================================================
// Publishing Schemas
// ============================================================

export const publishJobSchema = z.object({
  projectId: z.string().cuid(),
  publishAccountId: z.string().cuid(),
  platform: z.enum(['YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'TWITTER', 'CUSTOM']),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  hashtags: z.array(z.string()).optional(),
  platformSettings: z.record(z.unknown()).optional(),
});

// ============================================================
// Device & Version Schemas
// ============================================================

export const createVersionSchema = z.object({
  label: z.string().max(200).optional(),
  trigger: z.enum(['MANUAL', 'GENERATE', 'DELETE', 'AUTO']),
});

export const updateDeviceSchema = z.object({
  name: z.string().min(1).max(100),
});
