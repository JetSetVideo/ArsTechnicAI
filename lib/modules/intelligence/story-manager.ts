// ============================================================
// ARS TECHNICAI — Story Types & Management (ART-001/002/004)
// Full Story data model with chapters, characters, style guide.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';
import { v4 as uuidv4 } from 'uuid';

export const id = 'intel.story.manager';

// ─── Story Types ─────────────────────────────────────────────────────────

export interface Story {
  id: string;
  title: string;
  author: string;
  synopsis: string;
  chapters: Chapter[];
  characters: StoryCharacter[];
  styleGuide: StoryStyleGuide;
  coverImage?: string;
  status: 'draft' | 'in-progress' | 'illustrated' | 'published';
  createdAt: number;
  updatedAt: number;
  totalWordCount: number;
  totalIllustrations: number;
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  scenes: StoryScene[];
  summary: string;
  wordCount: number;
  targetIllustrations: number;
  status: 'draft' | 'prompted' | 'generated' | 'approved';
}

export interface StoryScene {
  id: string;
  number: number;
  title: string;
  description: string;
  dialogue: DialogueLine[];
  characters: string[];    // character IDs present
  location: string;        // location ID
  timeOfDay: string;
  mood: string;
  wordCount: number;
  keyMoments: string[];    // auto-detected key moment types
}

export interface DialogueLine {
  character: string;
  text: string;
  emotion: string;
  timing: number;
}

export interface StoryCharacter {
  id: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor' | 'cameo';
  arc: string;
  appearance: CharacterAppearance;
  firstAppearance: { chapter: number; scene: number };
  status: 'active' | 'dead' | 'missing' | 'transformed';
  illustrationCount: number;
}

export interface CharacterAppearance {
  gender: string;
  age: string;
  height: string;
  build: 'slim' | 'athletic' | 'average' | 'muscular' | 'heavy' | 'tall';
  skinTone: string;
  hairColor: string;
  hairStyle: string;
  eyeColor: string;
  facialFeatures: string;
  outfit: string;
  accessories: string[];
  distinguishing: string;
}

export interface StoryStyleGuide {
  artStyle: string;
  colorPalette: string[];
  lineWeight: 'thin' | 'medium' | 'thick';
  shading: 'flat' | 'cel' | 'soft' | 'realistic';
  atmosphere: string;
  era: string;
  referenceArt: string[];
}

// ─── Module ──────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<StoryCharacter['role'], string> = {
  protagonist: 'Protagonist', antagonist: 'Antagonist',
  supporting: 'Supporting', minor: 'Minor', cameo: 'Cameo',
};

export const BUILD_OPTIONS: CharacterAppearance['build'][] = ['slim', 'athletic', 'average', 'muscular', 'heavy', 'tall'];
export const LINE_WEIGHTS: StoryStyleGuide['lineWeight'][] = ['thin', 'medium', 'thick'];
export const SHADING_STYLES: StoryStyleGuide['shading'][] = ['flat', 'cel', 'soft', 'realistic'];

export function createEmptyStory(title: string = 'Untitled Story'): Story {
  return {
    id: uuidv4(),
    title,
    author: '',
    synopsis: '',
    chapters: [],
    characters: [],
    styleGuide: {
      artStyle: 'cinematic',
      colorPalette: ['#1a1a2e', '#e94560', '#0f3460', '#f5f5f5'],
      lineWeight: 'medium',
      shading: 'soft',
      atmosphere: 'dramatic',
      era: 'contemporary',
      referenceArt: [],
    },
    status: 'draft',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    totalWordCount: 0,
    totalIllustrations: 0,
  };
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Story Manager',
  category: 'intelligence',
  description: 'Manage story data: chapters, scenes, characters, dialogue, and style guides. Create, edit, validate, and track story progress. Ensures character consistency and style uniformity across all illustrations.',
  inputs: [
    { id: 'story', label: 'Story Object', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'story', label: 'Story Object', type: 'data', direction: 'output' },
    { id: 'stats', label: 'Story Stats', type: 'data', direction: 'output' },
    { id: 'validation', label: 'Validation Report', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'action', label: 'Action', type: 'enum', options: ['create', 'validate', 'stats', 'add-chapter', 'add-character'], default: 'create' },
    { id: 'title', label: 'Story Title', type: 'string', default: '' },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const action = (ctx.parameters.action as string) || 'create';

    if (action === 'create') {
      const story = createEmptyStory((ctx.parameters.title as string) || 'Untitled Story');
      return {
        outputs: { story, stats: getStoryStats(story), validation: validateStory(story) },
        metadata: { action: 'create' },
      };
    }

    const story = (ctx.inputs.story as Story) || createEmptyStory();

    if (action === 'validate') {
      return { outputs: { story, validation: validateStory(story) } };
    }

    if (action === 'stats') {
      return { outputs: { story, stats: getStoryStats(story) } };
    }

    return { outputs: { story }, metadata: { action } };
  },
};

export function validateStory(story: Story): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!story.title) issues.push('Story has no title');
  if (story.chapters.length === 0) issues.push('Story has no chapters');
  if (story.characters.length === 0) issues.push('Story has no characters');
  for (const ch of story.chapters) {
    if (ch.scenes.length === 0) issues.push(`Chapter ${ch.number} has no scenes`);
    if (ch.targetIllustrations < 1) issues.push(`Chapter ${ch.number} has no target illustrations`);
  }
  for (const c of story.characters) {
    if (!c.appearance.hairColor) issues.push(`Character "${c.name}" missing hair color`);
    if (!c.appearance.eyeColor) issues.push(`Character "${c.name}" missing eye color`);
  }
  return { valid: issues.length === 0, issues };
}

export function getStoryStats(story: Story) {
  const totalScenes = story.chapters.reduce((s, c) => s + c.scenes.length, 0);
  const totalDialogueLines = story.chapters.reduce((s, c) =>
    s + c.scenes.reduce((ss, sc) => ss + sc.dialogue.length, 0), 0);
  return {
    chapters: story.chapters.length,
    scenes: totalScenes,
    characters: story.characters.length,
    dialogueLines: totalDialogueLines,
    wordCount: story.totalWordCount,
    targetIllustrations: story.chapters.reduce((s, c) => s + c.targetIllustrations, 0),
    generatedIllustrations: story.totalIllustrations,
    status: story.status,
  };
}
