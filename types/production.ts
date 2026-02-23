export type ProductionStage =
  | 'idea'
  | 'glossary'
  | 'script'
  | 'sources'
  | 'dialogue'
  | 'prompt'
  | 'generation'
  | 'assembly'
  | 'export';

export type TimelineEntityType =
  | 'idea'
  | 'glossaryTerm'
  | 'scriptSegment'
  | 'sourceReference'
  | 'dialogueLine'
  | 'promptDraft'
  | 'promptVersion'
  | 'modelRun'
  | 'note';

export type StoryStatus = 'draft' | 'review' | 'approved' | 'archived';

export interface IdeaCard {
  id: string;
  title: string;
  description: string;
  tags: string[];
  status: StoryStatus;
  createdAt: number;
  updatedAt: number;
}

export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  aliases: string[];
  categories: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ScriptSegment {
  id: string;
  title: string;
  content: string;
  segmentType: 'outline' | 'beat' | 'scene' | 'shotlist' | 'voiceover';
  order: number;
  status: StoryStatus;
  createdAt: number;
  updatedAt: number;
}

export interface SourceReference {
  id: string;
  sourceType: 'image' | 'video' | 'audio' | 'text' | 'url' | 'document';
  label: string;
  uri?: string;
  notes?: string;
  tags: string[];
  linkedAssetId?: string;
  copyright?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DialogueLine {
  id: string;
  speaker: string;
  line: string;
  sceneRef?: string;
  tone?: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface PromptModelContext {
  provider: string;
  model: string;
  negativePrompt?: string;
  seed?: number;
  width?: number;
  height?: number;
  steps?: number;
  guidanceScale?: number;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  aspectRatio?: string;
  scheduler?: string;
  extraParams?: Record<string, unknown>;
}

export interface PromptDraft {
  id: string;
  title: string;
  promptText: string;
  intent?: string;
  tags: string[];
  status: StoryStatus;
  createdAt: number;
  updatedAt: number;
  latestVersionId?: string;
}

export interface PromptVersion {
  id: string;
  promptDraftId: string;
  versionLabel: string;
  modelContext: PromptModelContext;
  notes?: string;
  outputAssetIds: string[];
  createdAt: number;
}

export type ModelRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ModelRun {
  id: string;
  promptDraftId: string;
  promptVersionId: string;
  provider: string;
  model: string;
  status: ModelRunStatus;
  requestedAt: number;
  startedAt?: number;
  completedAt?: number;
  latencyMs?: number;
  errorMessage?: string;
  generationJobId?: string;
  outputAssetIds: string[];
  costUsd?: number;
  requestTokens?: number;
  responseTokens?: number;
  metadata?: Record<string, unknown>;
}

export interface ProductionTimelineEntry {
  id: string;
  order: number;
  stage: ProductionStage;
  entityType: TimelineEntityType;
  entityId?: string;
  title: string;
  notes?: string;
  createdAt: number;
}

export interface ProjectProductionRecord {
  projectId: string;
  projectName?: string;
  createdAt: number;
  updatedAt: number;
  ideas: IdeaCard[];
  glossary: GlossaryTerm[];
  script: ScriptSegment[];
  sources: SourceReference[];
  dialogues: DialogueLine[];
  prompts: PromptDraft[];
  promptVersions: PromptVersion[];
  modelRuns: ModelRun[];
  timeline: ProductionTimelineEntry[];
  nextTimelineOrder: number;
}

