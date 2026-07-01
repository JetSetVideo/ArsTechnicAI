// ============================================================
// ARS TECHNICAI — Scene Illustration Generator (ART-007)
// Detects key dramatic moments in scene text and generates
// illustration prompts with forced shot variety per moment.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'intel.scene.illustrator';

export interface KeyMoment {
  id: string;
  type: 'entrance' | 'confrontation' | 'revelation' | 'climax' | 'resolution' | 'dialogue' | 'action' | 'establishing';
  position: number;        // character position in text
  excerpt: string;         // the text that triggered this moment
  intensity: number;       // 0-1 how dramatic
  shotType: string;        // recommended shot type
  composition: string;     // recommended composition
  illustrationPrompt: string;
}

export interface IllustrationSet {
  sceneId: string;
  sceneTitle: string;
  keyMoments: KeyMoment[];
  illustrations: Array<{
    momentId: string;
    prompt: string;
    shotType: string;
    rationale: string;
  }>;
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Scene Illustration Generator',
  category: 'intelligence',
  description: 'Analyze scene text to detect key dramatic moments (entrance, confrontation, revelation, climax, resolution) and generate illustration prompts with forced shot variety. Ensures each illustration uses a different shot type for visual diversity.',
  inputs: [
    { id: 'sceneText', label: 'Scene Text', type: 'text', direction: 'input' },
    { id: 'characters', label: 'Character Names', type: 'data', direction: 'input', optional: true },
    { id: 'style', label: 'Visual Style', type: 'text', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'illustrations', label: 'Illustration Prompts', type: 'data', direction: 'output' },
    { id: 'keyMoments', label: 'Key Moments Detected', type: 'data', direction: 'output' },
    { id: 'summary', label: 'Scene Summary', type: 'text', direction: 'output' },
  ],
  parameters: [
    { id: 'maxIllustrations', label: 'Max Illustrations', type: 'number', default: 4, min: 1, max: 8 },
    { id: 'minIntensity', label: 'Min Moment Intensity', type: 'number', default: 0.3, min: 0, max: 1, step: 0.05 },
    { id: 'style', label: 'Art Style', type: 'string', default: 'cinematic' },
    { id: 'shotVariety', label: 'Force Shot Variety', type: 'boolean', default: true },
    { id: 'includeEstablishing', label: 'Always Include Establishing Shot', type: 'boolean', default: true },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const text = (ctx.inputs.sceneText as string) || '';
    const characters = (ctx.inputs.characters as string[]) || [];
    const style = ((ctx.parameters.style || ctx.inputs.style) as string) || 'cinematic';
    const maxIllustrations = (ctx.parameters.maxIllustrations as number) || 4;
    const minIntensity = (ctx.parameters.minIntensity as number) || 0.3;
    const forceVariety = ctx.parameters.shotVariety !== false;
    const includeEstablishing = ctx.parameters.includeEstablishing !== false;

    if (!text.trim()) {
      return { outputs: { illustrations: [], keyMoments: [], summary: 'No scene text provided.' }, metadata: { momentCount: 0 } };
    }

    // Detect key moments
    const moments = detectKeyMoments(text, characters);

    // Filter by minimum intensity
    let selected = moments.filter(m => m.intensity >= minIntensity);

    // Always include at least 1 moment
    if (selected.length === 0 && moments.length > 0) {
      selected = [moments.reduce((a, b) => a.intensity > b.intensity ? a : b)];
    }

    // If establishing shot requested and not already detected, add one
    if (includeEstablishing && !selected.some(m => m.type === 'establishing')) {
      selected.unshift({
        id: 'establishing-auto',
        type: 'establishing',
        position: 0,
        excerpt: text.slice(0, 80),
        intensity: 0.5,
        shotType: 'wide shot',
        composition: 'establishing shot, rule of thirds',
        illustrationPrompt: `Establishing shot of the scene: ${text.slice(0, 100)}`,
      });
    }

    // Cap at max
    selected = selected.slice(0, maxIllustrations);

    // Force shot variety: assign different shot types
    const shotTypes = ['wide shot', 'medium shot', 'close-up', 'extreme close-up', 'over-the-shoulder', 'low angle', 'high angle', 'POV'];
    if (forceVariety) {
      const usedShots = new Set<string>();
      for (const moment of selected) {
        // Pick a shot type not yet used
        const available = shotTypes.filter(s => !usedShots.has(s));
        if (available.length > 0) {
          moment.shotType = available[0];
          usedShots.add(available[0]);
        }
      }
    }

    // Build illustration prompts
    const illustrations = selected.map(moment => ({
      momentId: moment.id,
      prompt: buildIllustrationPrompt(moment, text, characters, style),
      shotType: moment.shotType,
      rationale: `${moment.type} moment (intensity: ${(moment.intensity * 100).toFixed(0)}%) — ${moment.shotType}`,
    }));

    const summary = `${selected.length} illustration(s) from ${moments.length} detected moments. ` +
      `Shot types: ${selected.map(m => m.shotType).join(', ')}.`;

    return {
      outputs: { illustrations, keyMoments: selected, summary },
      metadata: { momentCount: moments.length, selectedCount: selected.length, style },
    };
  },
};

function detectKeyMoments(text: string, characters: string[]): KeyMoment[] {
  const moments: KeyMoment[] = [];
  let idCounter = 0;

  const patterns: Array<{ regex: RegExp; type: KeyMoment['type']; intensity: number; shot: string; comp: string }> = [
    { regex: /\b(?:enters|appears|arrives|walks in|steps in|comes in)\b/i, type: 'entrance', intensity: 0.7, shot: 'medium shot', comp: 'rule of thirds' },
    { regex: /\b(?:confront|face.?off|stand.?off|argue|yell|shout|scream|fight|battle|attack|strike)\b/i, type: 'confrontation', intensity: 0.9, shot: 'close-up', comp: 'diagonal tension' },
    { regex: /\b(?:reveal|discovers|finds out|realizes|the truth|secret|uncover)\b/i, type: 'revelation', intensity: 0.85, shot: 'extreme close-up', comp: 'centered symmetry' },
    { regex: /\b(?:climax|peak|culmination|final battle|final confrontation|decisive moment)\b/i, type: 'climax', intensity: 1.0, shot: 'low angle', comp: 'golden ratio' },
    { regex: /\b(?:resolve|peace|reconcile|embrace|forgive|goodbye|ending|final|conclusion)\b/i, type: 'resolution', intensity: 0.6, shot: 'wide shot', comp: 'centered symmetry' },
    { regex: /\b(?:says|speaks|tells|asks|replies|whispers|declares|announces)\b/i, type: 'dialogue', intensity: 0.4, shot: 'over-the-shoulder', comp: 'rule of thirds' },
    { regex: /\b(?:runs|jumps|leaps|dives|throws|grabs|pulls|pushes|slams|bursts)\b/i, type: 'action', intensity: 0.75, shot: 'wide shot', comp: 'leading lines' },
  ];

  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.regex.source, 'gi');
    while ((match = regex.exec(text)) !== null) {
      // Avoid duplicate detections too close together
      const isDuplicate = moments.some(m => Math.abs(m.position - match.index) < 50);
      if (!isDuplicate) {
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + 50);
        moments.push({
          id: `moment-${++idCounter}`,
          type: pattern.type,
          position: match.index,
          excerpt: text.slice(start, end).trim(),
          intensity: pattern.intensity,
          shotType: pattern.shot,
          composition: pattern.comp,
          illustrationPrompt: '',
        });
      }
    }
  }

  // If no moments detected, create a default establishing shot
  if (moments.length === 0) {
    moments.push({
      id: 'moment-default',
      type: 'establishing',
      position: 0,
      excerpt: text.slice(0, 100),
      intensity: 0.5,
      shotType: 'wide shot',
      composition: 'rule of thirds',
      illustrationPrompt: '',
    });
  }

  // Sort by position in text
  moments.sort((a, b) => a.position - b.position);

  return moments;
}

function buildIllustrationPrompt(
  moment: KeyMoment,
  fullText: string,
  characters: string[],
  style: string,
): string {
  const parts: string[] = [];

  // Scene context from surrounding text
  const contextStart = Math.max(0, moment.position - 100);
  const contextEnd = Math.min(fullText.length, moment.position + 100);
  const context = fullText.slice(contextStart, contextEnd).replace(/\n/g, ' ').trim();

  parts.push(context.slice(0, 200));
  parts.push(moment.shotType);
  parts.push(`${moment.composition} composition`);
  
  if (characters.length > 0) {
    parts.push(`featuring ${characters.slice(0, 3).join(', ')}`);
  }

  parts.push(`${moment.type} scene moment`);
  parts.push(`${style} style, 8K, ultra-detailed, professional cinematography`);

  return parts.filter(Boolean).join('. ');
}
