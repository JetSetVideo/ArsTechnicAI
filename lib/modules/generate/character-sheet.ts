// ============================================================
// ARS TECHNICAI — Character Creator Module
// Generates consistent character sheets with mannequin poses,
// backgrounds, lighting, camera settings for AI generation.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.character.sheet';

export interface CharacterProfile {
  id: string;
  name: string;
  appearance: {
    gender: string;
    age: string;
    height: string;
    build: string;
    skinTone: string;
    hairColor: string;
    hairStyle: string;
    eyeColor: string;
    facialFeatures: string;
    distinguishing: string;
  };
  outfit: {
    style: string;
    colors: string[];
    accessories: string[];
    footwear: string;
  };
  poses: MannequinPose[];
  settings: CharacterSheetSettings;
}

export interface MannequinPose {
  id: string;
  name: 't-pose' | 'a-pose' | 'standing' | 'walking' | 'sitting' | 'fighting' | 'portrait' | 'action' | 'relaxed' | 'running';
  angle: 'front' | 'side' | 'back' | 'three-quarter' | 'low-angle' | 'high-angle';
  expression: string;
  handPosition: string;
}

export interface CharacterSheetSettings {
  background: {
    type: 'solid' | 'gradient' | 'environment' | 'transparent';
    color: string;
    environmentDesc: string;
  };
  lighting: {
    setup: 'studio-3pt' | 'rembrandt' | 'golden-hour' | 'neon-noir' | 'overcast' | 'dramatic' | 'rim-only';
    keyIntensity: number;
    fillRatio: number;
    colorTemp: number;
  };
  camera: {
    lens: '24mm' | '35mm' | '50mm' | '85mm' | '135mm' | '200mm';
    aperture: string;
    distance: string;
    angle: string;
    focus: string;
  };
  output: {
    width: number;
    height: number;
    format: 'png' | 'jpg';
    includeReferenceGrid: boolean;
    includeColorSwatches: boolean;
  };
}

export const POSE_LIBRARY: MannequinPose[] = [
  { id: 'front-standing', name: 'standing', angle: 'front', expression: 'neutral', handPosition: 'at sides' },
  { id: 'side-standing', name: 'standing', angle: 'side', expression: 'neutral', handPosition: 'at sides' },
  { id: 'back-standing', name: 'standing', angle: 'back', expression: 'neutral', handPosition: 'at sides' },
  { id: 'threeq-standing', name: 'standing', angle: 'three-quarter', expression: 'neutral', handPosition: 'relaxed' },
  { id: 'front-action', name: 'action', angle: 'front', expression: 'determined', handPosition: 'weapon ready' },
  { id: 'side-action', name: 'action', angle: 'side', expression: 'focused', handPosition: 'dynamic' },
  { id: 'front-portrait', name: 'portrait', angle: 'front', expression: 'confident', handPosition: 'chest level' },
  { id: 'front-walking', name: 'walking', angle: 'three-quarter', expression: 'neutral', handPosition: 'natural swing' },
  { id: 'sitting-relaxed', name: 'sitting', angle: 'front', expression: 'relaxed', handPosition: 'on lap' },
  { id: 'low-hero', name: 'standing', angle: 'low-angle', expression: 'heroic', handPosition: 'on hip' },
  { id: 'high-dramatic', name: 'standing', angle: 'high-angle', expression: 'vulnerable', handPosition: 'outstretched' },
  { id: 'front-fighting', name: 'fighting', angle: 'front', expression: 'intense', handPosition: 'guard up' },
];

export const LIGHTING_PRESETS = {
  'studio-3pt': { keyIntensity: 1.0, fillRatio: 0.5, colorTemp: 5600, desc: 'Professional three-point: key, fill, back/rim' },
  'rembrandt': { keyIntensity: 1.2, fillRatio: 0.2, colorTemp: 3200, desc: 'Dramatic triangle cheek light, dark side' },
  'golden-hour': { keyIntensity: 0.8, fillRatio: 0.6, colorTemp: 4500, desc: 'Warm low sun, long shadows, atmospheric' },
  'neon-noir': { keyIntensity: 0.6, fillRatio: 0.3, colorTemp: 6500, desc: 'Mixed colored practicals, high contrast' },
  'overcast': { keyIntensity: 0.4, fillRatio: 0.9, colorTemp: 7000, desc: 'Soft diffused light, minimal shadows' },
  'dramatic': { keyIntensity: 1.5, fillRatio: 0.1, colorTemp: 2800, desc: 'Theatrical top spot, deep dramatic shadows' },
  'rim-only': { keyIntensity: 0.3, fillRatio: 0.0, colorTemp: 5600, desc: 'Silhouette with edge highlight only' },
};

export const moduleDef: ModuleDef = {
  id,
  name: 'Character Sheet Generator',
  category: 'generate',
  description: 'Generate consistent character reference sheets with mannequin poses, backgrounds, lighting setups, and camera configurations. Outputs structured prompts for AI image generation that maintain character consistency across multiple generations.',
  inputs: [
    { id: 'characterProfile', label: 'Character Profile', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'generationPrompts', label: 'Generation Prompts', type: 'data', direction: 'output' },
    { id: 'characterSheet', label: 'Character Sheet JSON', type: 'data', direction: 'output' },
    { id: 'posePrompts', label: 'Per-Pose Prompts', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'characterName', label: 'Character Name', type: 'string', default: '' },
    { id: 'gender', label: 'Gender', type: 'enum', options: ['male', 'female', 'non-binary', 'unspecified'], default: 'unspecified' },
    { id: 'age', label: 'Age Range', type: 'enum', options: ['young adult', 'adult', 'middle-aged', 'elder', 'ageless'], default: 'adult' },
    { id: 'hairColor', label: 'Hair Color', type: 'string', default: '' },
    { id: 'eyeColor', label: 'Eye Color', type: 'string', default: '' },
    { id: 'skinTone', label: 'Skin Tone', type: 'string', default: '' },
    { id: 'build', label: 'Build', type: 'enum', options: ['slim', 'athletic', 'average', 'muscular', 'heavy', 'tall'], default: 'athletic' },
    { id: 'outfitStyle', label: 'Outfit Style', type: 'string', default: '' },
    { id: 'poses', label: 'Poses (comma-separated)', type: 'string', default: 'front-standing,side-standing,back-standing,front-portrait,front-action' },
    { id: 'backgroundType', label: 'Background', type: 'enum', options: ['solid', 'gradient', 'transparent'], default: 'solid' },
    { id: 'backgroundColor', label: 'Background Color', type: 'color', default: '#1a1a2e' },
    { id: 'lightingSetup', label: 'Lighting Setup', type: 'enum', options: ['studio-3pt', 'rembrandt', 'golden-hour', 'neon-noir', 'overcast', 'dramatic', 'rim-only'], default: 'studio-3pt' },
    { id: 'cameraLens', label: 'Camera Lens', type: 'enum', options: ['24mm', '35mm', '50mm', '85mm', '135mm', '200mm'], default: '85mm' },
    { id: 'outputWidth', label: 'Output Width', type: 'number', default: 1024, min: 512, max: 2048, step: 64 },
    { id: 'outputHeight', label: 'Output Height', type: 'number', default: 1024, min: 512, max: 2048, step: 64 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const params = ctx.parameters;
    const poseIds = (params.poses as string || 'front-standing').split(',').map(s => s.trim());
    
    // Build the character appearance block
    const appearance = [
      params.gender !== 'unspecified' ? params.gender : '',
      params.age,
      params.build,
      params.skinTone ? `${params.skinTone} skin` : '',
      params.hairColor ? `${params.hairColor} hair` : '',
      params.eyeColor ? `${params.eyeColor} eyes` : '',
    ].filter(Boolean).join(', ');

    const lightingSetup = params.lightingSetup as string || 'studio-3pt';
    const lighting = LIGHTING_PRESETS[lightingSetup] || LIGHTING_PRESETS['studio-3pt'];
    
    // Generate prompts for each pose
    const posePrompts: Array<{poseId: string; prompt: string}> = [];
    
    for (const poseId of poseIds) {
      const pose = POSE_LIBRARY.find(p => p.id === poseId) || POSE_LIBRARY[0];
      
      const prompt = [
        `Full body character reference sheet`,
        appearance ? `of ${params.characterName || 'character'}, ${appearance}` : '',
        params.outfitStyle ? `wearing ${params.outfitStyle}` : '',
        `${pose.name} pose, ${pose.angle} view, ${pose.expression} expression, hands ${pose.handPosition}`,
        `${params.backgroundType || 'solid'} background${params.backgroundType === 'solid' ? `, color ${params.backgroundColor || '#1a1a2e'}` : ''}`,
        `${lighting.desc}`,
        `${params.cameraLens || '85mm'} lens, ${params.cameraLens === '85mm' ? 'f/1.8 shallow depth of field' : 'professional photography'}`,
        'character reference sheet, consistent character design, full body, clean composition, 8K resolution, ultra detailed, professional photography',
      ].filter(Boolean).join(', ');
      
      posePrompts.push({ poseId, prompt });
    }
    
    return {
      outputs: {
        generationPrompts: posePrompts.map(p => p.prompt),
        characterSheet: { appearance, poses: posePrompts, settings: { lighting, background: params.backgroundType, camera: params.cameraLens } },
        posePrompts,
      },
      metadata: { poseCount: posePrompts.length, lightingSetup, characterName: params.characterName },
    };
  },
};
