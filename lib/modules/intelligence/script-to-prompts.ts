// ============================================================
// ARS TECHNICAI — Script to Image Prompts
// Converts narrative scripts into individual scene image prompts
// with shot types, composition guides, and character positions.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'intel.script.to.prompts';

export interface ScenePrompt {
  id: string;
  sceneNumber: number;
  sceneTitle: string;
  description: string;
  imagePrompt: string;
  shotType: string;
  composition: string;
  lighting: string;
  mood: string;
  characterPositions: CharacterPosition[];
  duration: number;
  dialogue: string;
}

export interface CharacterPosition {
  character: string;
  position: 'center' | 'left' | 'right' | 'foreground' | 'background' | 'off-screen';
  action: string;
  facing: string;
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Script to Prompts',
  category: 'intelligence',
  description: 'Convert narrative scripts into individual scene image prompts. Analyzes script structure to extract scene descriptions, shot types, lighting, mood, and character positions. Generates ready-to-use AI image prompts for each scene.',
  inputs: [
    { id: 'script', label: 'Script Text', type: 'text', direction: 'input' },
    { id: 'style', label: 'Visual Style', type: 'text', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'scenes', label: 'Scene Prompts', type: 'data', direction: 'output' },
    { id: 'prompts', label: 'Image Prompts Array', type: 'data', direction: 'output' },
    { id: 'summary', label: 'Script Summary', type: 'text', direction: 'output' },
  ],
  parameters: [
    { id: 'style', label: 'Visual Style', type: 'enum', options: ['cinematic', 'anime', 'photorealistic', 'comic', 'storyboard', 'concept-art'], default: 'cinematic' },
    { id: 'aspectRatio', label: 'Aspect Ratio', type: 'enum', options: ['16:9', '9:16', '1:1', '21:9', '4:5'], default: '16:9' },
    { id: 'includeLighting', label: 'Include Lighting', type: 'boolean', default: true },
    { id: 'includeComposition', label: 'Include Composition', type: 'boolean', default: true },
    { id: 'includeCharacters', label: 'Include Character Positions', type: 'boolean', default: true },
    { id: 'autoDetectScenes', label: 'Auto-detect Scenes', type: 'boolean', default: true },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const script = (ctx.inputs.script as string) || '';
    const style = ((ctx.parameters.style || ctx.inputs.style) as string) || 'cinematic';
    const includeLight = ctx.parameters.includeLighting !== false;
    const includeComp = ctx.parameters.includeComposition !== false;
    const includeChars = ctx.parameters.includeCharacters !== false;

    if (!script.trim()) {
      return { outputs: { scenes: [], prompts: [], summary: 'No script provided.' }, metadata: { sceneCount: 0 } };
    }

    // Parse script into scenes
    const scenes = parseScript(script, style, includeLight, includeComp, includeChars);
    
    // Generate pure image prompts array
    const prompts = scenes.map(s => s.imagePrompt);
    
    // Generate summary
    const summary = generateSummary(scenes);

    return {
      outputs: { scenes, prompts, summary },
      metadata: { sceneCount: scenes.length, style, totalDuration: scenes.reduce((s, sc) => s + sc.duration, 0) },
    };
  },
};

/** Parse a narrative script into structured scene prompts */
function parseScript(
  script: string,
  style: string,
  includeLighting: boolean,
  includeComposition: boolean,
  includeCharacters: boolean,
): ScenePrompt[] {
  const scenes: ScenePrompt[] = [];
  
  // Split by scene markers: "SCENE", "INT.", "EXT.", "##", numbered lines
  const sceneMarkers = /(?:^|\n)(?:(?:SCENE|Scene)\s*\d+|INT\.|EXT\.|##\s*Scene|\d+\.\s)/gm;
  const parts = script.split(sceneMarkers).filter(Boolean);
  
  // If no scene markers found, treat entire script as one scene
  if (parts.length <= 1) {
    // Try to split by double newlines (paragraphs as scenes)
    const paragraphs = script.split(/\n\s*\n/).filter(p => p.trim().length > 10);
    if (paragraphs.length > 1) {
      paragraphs.forEach((para, i) => {
        scenes.push(buildScene(para.trim(), i + 1, style, includeLighting, includeComposition, includeCharacters));
      });
    } else {
      scenes.push(buildScene(script.trim(), 1, style, includeLighting, includeComposition, includeCharacters));
    }
  } else {
    parts.forEach((part, i) => {
      if (part.trim().length > 5) {
        scenes.push(buildScene(part.trim(), i + 1, style, includeLighting, includeComposition, includeCharacters));
      }
    });
  }

  return scenes;
}

/** Build a single scene prompt from text */
function buildScene(
  text: string,
  sceneNum: number,
  style: string,
  includeLighting: boolean,
  includeComposition: boolean,
  includeCharacters: boolean,
): ScenePrompt {
  // Extract metadata from text
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const firstLine = lines[0] || text.slice(0, 80);
  const fullText = lines.join(' ');

  // Detect scene title from first line
  const titleMatch = firstLine.match(/^(?:SCENE\s*\d+[:\-]?\s*)?(.{3,60})/i);
  const sceneTitle = titleMatch ? titleMatch[1].trim() : `Scene ${sceneNum}`;

  // Detect shot type
  const shotType = detectPattern(fullText, {
    'extreme close-up': /\b(?:ECU|extreme close.?up)\b/i,
    'close-up': /\b(?:CU|close.?up)\b/i,
    'medium shot': /\b(?:MS|medium shot|mid shot)\b/i,
    'wide shot': /\b(?:WS|wide shot|establishing|long shot)\b/i,
    'over-the-shoulder': /\b(?:OTS|over.the.shoulder)\b/i,
    'two-shot': /\b(?:two.?shot|2.?shot)\b/i,
    'POV': /\b(?:POV|point.of.view)\b/i,
  }, 'wide shot');

  // Detect lighting
  const lighting = detectPattern(fullText, {
    'golden hour': /\b(?:golden hour|sunset|sunrise|magic hour)\b/i,
    'low key dramatic': /\b(?:low key|dark|shadowy|noir|chiaroscuro)\b/i,
    'high key bright': /\b(?:high key|bright|well.lit|daylight)\b/i,
    'neon': /\b(?:neon|fluorescent|colored light)\b/i,
    'practical': /\b(?:candle|firelight|lamp|practical)\b/i,
    'natural window': /\b(?:window light|natural light|daylight)\b/i,
  }, 'natural ambient');

  // Detect mood
  const mood = detectPattern(fullText, {
    'tense': /\b(?:tense|suspense|anxiety|fear|danger|threat)\b/i,
    'peaceful': /\b(?:calm|peace|serene|tranquil|quiet)\b/i,
    'dramatic': /\b(?:dramatic|intense|powerful|epic)\b/i,
    'melancholic': /\b(?:sad|melancholy|sorrow|grief|lonely)\b/i,
    'joyful': /\b(?:happy|joy|celebration|laughter|cheerful)\b/i,
    'mysterious': /\b(?:mystery|cryptic|unknown|secret|hidden)\b/i,
  }, 'neutral');

  // Detect characters
  const characters: CharacterPosition[] = [];
  if (includeCharacters) {
    const charRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:\((\d+[mf]?)\))?\s*(?:enters|exits|stands|sits|walks|runs|speaks|looks|moves|appears)/g;
    let match;
    while ((match = charRegex.exec(fullText)) !== null && characters.length < 5) {
      const name = match[1];
      if (!characters.find(c => c.character === name) && name.length > 2) {
        characters.push({
          character: name,
          position: ['center', 'left', 'right', 'foreground', 'background'][characters.length % 5] as CharacterPosition['position'],
          action: detectAction(fullText, name),
          facing: 'camera',
        });
      }
    }
    // If no characters detected, check for common patterns
    if (characters.length === 0) {
      const subjectMatch = fullText.match(/\b(?:a|the)\s+(\w+(?:\s+\w+)?)\s+(?:is|stands|sits|walks|appears)/i);
      if (subjectMatch) {
        characters.push({
          character: subjectMatch[1],
          position: 'center',
          action: 'standing',
          facing: 'camera',
        });
      }
    }
  }

  // Detect composition
  const composition = detectPattern(fullText, {
    'rule of thirds': /\b(?:rule of thirds|off.center)\b/i,
    'centered symmetry': /\b(?:centered|symmetr|center frame)\b/i,
    'leading lines': /\b(?:leading lines|corridor|alley|path)\b/i,
    'Dutch angle': /\b(?:dutch|tilted|canted|angled)\b/i,
    'frame within frame': /\b(?:frame within|doorway|window frame|archway)\b/i,
  }, 'rule of thirds');

  // Detect dialogue
  const dialogueMatches = fullText.match(/[""]([^""]+)[""]/g);
  const dialogue = dialogueMatches ? dialogueMatches.map(d => d.replace(/[""]/g, '"')).join(' | ') : '';

  // Estimate duration based on dialogue and description length
  const wordCount = fullText.split(/\s+/).length;
  const dialogueCount = dialogue ? dialogue.split(/\s+/).length : 0;
  const duration = Math.max(3, Math.round(dialogueCount * 0.4 + (wordCount - dialogueCount) * 0.1));

  // Build the image prompt
  const promptParts: string[] = [];
  promptParts.push(`${sceneTitle}`);
  promptParts.push(`${shotType}`);
  if (includeComposition) promptParts.push(`${composition} composition`);
  if (includeLighting) promptParts.push(`${lighting} lighting`);
  promptParts.push(`${mood} atmosphere`);
  if (characters.length > 0) {
    promptParts.push(characters.map(c => `${c.character} ${c.position} ${c.action}`).join(', '));
  }
  promptParts.push(`${style} style, 8K, ultra-detailed`);

  return {
    id: `scene-${sceneNum}`,
    sceneNumber: sceneNum,
    sceneTitle,
    description: fullText.slice(0, 200),
    imagePrompt: promptParts.join('. '),
    shotType,
    composition,
    lighting,
    mood,
    characterPositions: characters,
    duration,
    dialogue,
  };
}

function detectPattern(text: string, patterns: Record<string, RegExp>, fallback: string): string {
  for (const [label, regex] of Object.entries(patterns)) {
    if (regex.test(text)) return label;
  }
  return fallback;
}

function detectAction(text: string, characterName: string): string {
  const actionPatterns: Record<string, RegExp> = {
    'standing': new RegExp(`${characterName}\\s+(?:stands|is standing)`, 'i'),
    'sitting': new RegExp(`${characterName}\\s+(?:sits|is sitting|seated)`, 'i'),
    'walking': new RegExp(`${characterName}\\s+(?:walks|walking|strides)`, 'i'),
    'running': new RegExp(`${characterName}\\s+(?:runs|running|sprints)`, 'i'),
    'fighting': new RegExp(`${characterName}\\s+(?:fights|attacks|strikes|combat)`, 'i'),
    'speaking': new RegExp(`${characterName}\\s+(?:says|speaks|tells|shouts|whispers)`, 'i'),
    'looking': new RegExp(`${characterName}\\s+(?:looks|gazes|stares|watches)`, 'i'),
    'holding': new RegExp(`${characterName}\\s+(?:holds|carries|grasps|clutches)`, 'i'),
  };
  for (const [action, regex] of Object.entries(actionPatterns)) {
    if (regex.test(text)) return action;
  }
  return 'standing';
}

function generateSummary(scenes: ScenePrompt[]): string {
  const totalDuration = scenes.reduce((s, sc) => s + sc.duration, 0);
  const allChars = new Set<string>();
  scenes.forEach(s => s.characterPositions.forEach(c => allChars.add(c.character)));
  const moods = scenes.map(s => s.mood);
  const dominantMood = moods.sort((a, b) => moods.filter(m => m === a).length - moods.filter(m => m === b).length).pop();

  return [
    `Script Breakdown: ${scenes.length} scenes, ~${totalDuration}s total`,
    `Characters: ${allChars.size > 0 ? [...allChars].join(', ') : 'none detected'}`,
    `Dominant mood: ${dominantMood}`,
    `Shot types: ${[...new Set(scenes.map(s => s.shotType))].join(', ')}`,
  ].join(' | ');
}
