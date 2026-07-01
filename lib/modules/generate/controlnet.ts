// ============================================================
// ARS TECHNICAI — ControlNet Node (COMFY-009)
// Guide image generation with 12 control types.
// Each type has a preprocessor and strength control.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.controlnet';

export type ControlType = 'canny' | 'depth' | 'normal' | 'openpose' | 'scribble' | 'segmentation' | 'lineart' | 'softedge' | 'shuffle' | 'ip2p' | 'tile' | 'recolor';

export interface ControlNetConfig {
  type: ControlType;
  strength: number;
  startPercent: number;
  endPercent: number;
  preprocessor: string;
  preprocessorParams: Record<string, unknown>;
}

export const CONTROL_TYPES: Array<{ id: ControlType; name: string; preprocessor: string; description: string }> = [
  { id: 'canny', name: 'Canny Edge', preprocessor: 'CannyEdgeDetect', description: 'Detect hard edges. Good for preserving structure and outlines.' },
  { id: 'depth', name: 'Depth Map', preprocessor: 'DepthAnything', description: 'Estimate depth from image. Controls spatial layout and perspective.' },
  { id: 'normal', name: 'Normal Map', preprocessor: 'NormalBaeDetect', description: 'Surface normal directions. Controls lighting and surface detail.' },
  { id: 'openpose', name: 'OpenPose', preprocessor: 'OpenPoseDetect', description: 'Human pose skeleton. Controls character pose and body position.' },
  { id: 'scribble', name: 'Scribble', preprocessor: 'FakeScribble', description: 'Rough sketch input. Loose guidance for composition.' },
  { id: 'segmentation', name: 'Segmentation', preprocessor: 'OneFormerDetect', description: 'Semantic segmentation map. Controls what goes where in the scene.' },
  { id: 'lineart', name: 'Line Art', preprocessor: 'LineArtDetect', description: 'Clean line extraction. Good for illustration and anime style.' },
  { id: 'softedge', name: 'Soft Edge', preprocessor: 'HEDDetect', description: 'Soft edge detection. Subtle structural guidance.' },
  { id: 'shuffle', name: 'Color Shuffle', preprocessor: 'ShufflePreprocessor', description: 'Randomizes colors while keeping structure. Creative variations.' },
  { id: 'ip2p', name: 'Instruct Pix2Pix', preprocessor: 'None', description: 'Follow text instructions to modify image.' },
  { id: 'tile', name: 'Tile/Blur', preprocessor: 'TilePreprocessor', description: 'Tile-based processing. Good for upscaling and detail enhancement.' },
  { id: 'recolor', name: 'Recolor', preprocessor: 'RecolorPreprocessor', description: 'Transfer color palette while preserving luminance.' },
];

export const moduleDef: ModuleDef = {
  id,
  name: 'ControlNet',
  category: 'generate',
  description: 'Guide AI image generation using control images. 12 control types: canny edge, depth, normal map, openpose skeleton, scribble, segmentation, lineart, softedge, shuffle, instruct-pix2pix, tile, recolor. Each with configurable strength, start/end percent, and preprocessor.',
  inputs: [
    { id: 'image', label: 'Control Image', type: 'image', direction: 'input' },
    { id: 'conditioning', label: 'Conditioning', type: 'conditioning', direction: 'input', optional: true },
    { id: 'model', label: 'ControlNet Model', type: 'model', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'conditioning', label: 'Controlled Conditioning', type: 'conditioning', direction: 'output' },
    { id: 'controlImage', label: 'Processed Control Image', type: 'image', direction: 'output' },
    { id: 'controlConfig', label: 'Control Config', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'controlType', label: 'Control Type', type: 'enum', options: CONTROL_TYPES.map(c => c.id), default: 'canny' },
    { id: 'strength', label: 'Strength', type: 'number', default: 0.8, min: 0, max: 1, step: 0.05 },
    { id: 'startPercent', label: 'Start %', type: 'number', default: 0, min: 0, max: 1, step: 0.05 },
    { id: 'endPercent', label: 'End %', type: 'number', default: 1, min: 0, max: 1, step: 0.05 },
    { id: 'lowThreshold', label: 'Canny Low Threshold', type: 'number', default: 100, min: 0, max: 255 },
    { id: 'highThreshold', label: 'Canny High Threshold', type: 'number', default: 200, min: 0, max: 255 },
    { id: 'resolution', label: 'Preprocessor Resolution', type: 'number', default: 512, min: 64, max: 2048, step: 64 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const controlType = (ctx.parameters.controlType as ControlType) || 'canny';
    const strength = (ctx.parameters.strength as number) || 0.8;
    const startPct = (ctx.parameters.startPercent as number) || 0;
    const endPct = (ctx.parameters.endPercent as number) || 1;

    const typeInfo = CONTROL_TYPES.find(c => c.id === controlType)!;

    ctx.onProgress?.(20, `Preprocessing with ${typeInfo.preprocessor}...`);
    ctx.onProgress?.(50, `Applying ${typeInfo.name} at ${(strength * 100).toFixed(0)}% strength...`);
    ctx.onProgress?.(80, `Control active: ${(startPct * 100).toFixed(0)}% → ${(endPct * 100).toFixed(0)}% of generation`);

    const config: ControlNetConfig = {
      type: controlType,
      strength,
      startPercent: startPct,
      endPercent: endPct,
      preprocessor: typeInfo.preprocessor,
      preprocessorParams: {
        lowThreshold: ctx.parameters.lowThreshold || 100,
        highThreshold: ctx.parameters.highThreshold || 200,
        resolution: ctx.parameters.resolution || 512,
      },
    };

    return {
      outputs: {
        controlConfig: config,
        controlImage: null, // requires actual ControlNet inference
        conditioning: null,
      },
      metadata: {
        controlType,
        strength,
        startPercent: startPct,
        endPercent: endPct,
        preprocessor: typeInfo.preprocessor,
        description: typeInfo.description,
      },
    };
  },
};
