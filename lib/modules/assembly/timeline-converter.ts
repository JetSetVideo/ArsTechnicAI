// ============================================================
// ARS TECHNICAI — Timeline Format Converter
// Cut, extend, and convert results between formats.
// Auto-detect aspect ratios and apply platform constraints.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'asm.timeline.converter';

export interface TimelineClip {
  id: string;
  sourceAssetId: string;
  sourceFormat: { width: number; height: number };
  targetFormat: { width: number; height: number };
  startTime: number;
  endTime: number;
  duration: number;
  operation: 'cut' | 'extend' | 'letterbox' | 'crop' | 'scale' | 'loop';
  params: Record<string, number>;
}

export interface FormatPreset {
  name: string;
  width: number;
  height: number;
  aspectRatio: string;
  platforms: string[];
  safeZonePercent: number;
  maxDuration: number;
}

export const FORMAT_PRESETS: FormatPreset[] = [
  { name: 'Instagram Post', width: 1080, height: 1080, aspectRatio: '1:1', platforms: ['instagram'], safeZonePercent: 0.9, maxDuration: 60 },
  { name: 'Instagram Story', width: 1080, height: 1920, aspectRatio: '9:16', platforms: ['instagram'], safeZonePercent: 0.85, maxDuration: 15 },
  { name: 'Instagram Reel', width: 1080, height: 1920, aspectRatio: '9:16', platforms: ['instagram'], safeZonePercent: 0.85, maxDuration: 90 },
  { name: 'YouTube 1080p', width: 1920, height: 1080, aspectRatio: '16:9', platforms: ['youtube'], safeZonePercent: 0.95, maxDuration: 43200 },
  { name: 'YouTube Shorts', width: 1080, height: 1920, aspectRatio: '9:16', platforms: ['youtube'], safeZonePercent: 0.85, maxDuration: 60 },
  { name: 'TikTok', width: 1080, height: 1920, aspectRatio: '9:16', platforms: ['tiktok'], safeZonePercent: 0.85, maxDuration: 180 },
  { name: 'X Post', width: 1200, height: 675, aspectRatio: '16:9', platforms: ['x'], safeZonePercent: 0.92, maxDuration: 140 },
  { name: 'X Vertical', width: 1080, height: 1920, aspectRatio: '9:16', platforms: ['x'], safeZonePercent: 0.85, maxDuration: 140 },
  { name: 'LinkedIn', width: 1920, height: 1080, aspectRatio: '16:9', platforms: ['linkedin'], safeZonePercent: 0.9, maxDuration: 600 },
  { name: 'Facebook Feed', width: 1280, height: 720, aspectRatio: '16:9', platforms: ['facebook'], safeZonePercent: 0.9, maxDuration: 240 },
  { name: 'Wide Cinema', width: 2560, height: 1080, aspectRatio: '2.35:1', platforms: ['cinema'], safeZonePercent: 0.95, maxDuration: 999999 },
  { name: 'Square', width: 1080, height: 1080, aspectRatio: '1:1', platforms: ['universal'], safeZonePercent: 0.9, maxDuration: 999999 },
];

export interface ConversionResult {
  clips: TimelineClip[];
  totalDuration: number;
  sourceFormat: string;
  targetFormat: string;
  operations: string[];
  warnings: string[];
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Timeline Format Converter',
  category: 'assembly',
  description: 'Convert timeline results between formats automatically. Cut, extend, letterbox, crop, or scale clips to fit target platform dimensions. Supports 12 format presets across 6 platforms. Auto-handles aspect ratio mismatches.',
  inputs: [
    { id: 'assets', label: 'Asset List', type: 'data', direction: 'input' },
    { id: 'durations', label: 'Asset Durations (seconds)', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'clips', label: 'Converted Clips', type: 'data', direction: 'output' },
    { id: 'result', label: 'Conversion Result', type: 'data', direction: 'output' },
    { id: 'summary', label: 'Conversion Summary', type: 'text', direction: 'output' },
  ],
  parameters: [
    { id: 'targetFormat', label: 'Target Format', type: 'enum', options: FORMAT_PRESETS.map(f => f.name), default: 'YouTube 1080p' },
    { id: 'sourceFormat', label: 'Source Format', type: 'enum', options: ['auto-detect', ...FORMAT_PRESETS.map(f => f.name)], default: 'auto-detect' },
    { id: 'operation', label: 'Fit Method', type: 'enum', options: ['letterbox', 'crop', 'scale', 'stretch'], default: 'letterbox' },
    { id: 'cutThreshold', label: 'Cut if > (seconds)', type: 'number', default: 60, min: 1, max: 3600 },
    { id: 'loopShorter', label: 'Loop if < target duration', type: 'boolean', default: true },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const assets = (ctx.inputs.assets as any[]) || [];
    const durations = (ctx.inputs.durations as number[]) || [];
    const targetName = (ctx.parameters.targetFormat as string) || 'YouTube 1080p';
    const operation = (ctx.parameters.operation as string) || 'letterbox';
    const cutThreshold = (ctx.parameters.cutThreshold as number) || 60;
    const loopShorter = ctx.parameters.loopShorter !== false;

    if (assets.length === 0) {
      return { outputs: { clips: [], result: null, summary: 'No assets to convert.' }, metadata: { count: 0 } };
    }

    const target = FORMAT_PRESETS.find(f => f.name === targetName) || FORMAT_PRESETS[1];
    const warnings: string[] = [];
    const clips: TimelineClip[] = [];
    let currentTime = 0;

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const srcW = asset.width || 1024;
      const srcH = asset.height || 1024;
      const duration = durations[i] || asset.duration || 5;

      let clipDuration = duration;
      let op: TimelineClip['operation'] = operation as TimelineClip['operation'];

      // Cut if too long
      if (clipDuration > cutThreshold && cutThreshold > 0) {
        clipDuration = cutThreshold;
        op = 'cut';
        warnings.push(`Clip ${i + 1} cut from ${duration}s to ${cutThreshold}s`);
      }

      // Loop if too short
      if (loopShorter && clipDuration < 2 && target.maxDuration > 5) {
        const loops = Math.ceil(5 / clipDuration);
        clipDuration *= loops;
        op = 'loop';
        warnings.push(`Clip ${i + 1} looped ${loops}x for minimum duration`);
      }

      clips.push({
        id: `clip-${i}`,
        sourceAssetId: asset.id || `asset-${i}`,
        sourceFormat: { width: srcW, height: srcH },
        targetFormat: { width: target.width, height: target.height },
        startTime: currentTime,
        endTime: currentTime + clipDuration,
        duration: clipDuration,
        operation: op,
        params: getConversionParams(srcW, srcH, target.width, target.height, op),
      });

      currentTime += clipDuration;
    }

    // Final duration check against platform max
    if (currentTime > target.maxDuration && target.maxDuration < 999999) {
      warnings.push(`Total duration ${currentTime.toFixed(0)}s exceeds ${target.name} limit of ${target.maxDuration}s`);
    }

    const result: ConversionResult = {
      clips,
      totalDuration: currentTime,
      sourceFormat: `${assets[0]?.width || 1024}×${assets[0]?.height || 1024}`,
      targetFormat: `${target.width}×${target.height} (${target.aspectRatio})`,
      operations: [...new Set(clips.map(c => c.operation))],
      warnings,
    };

    return {
      outputs: {
        clips,
        result,
        summary: `${assets.length} assets → ${target.name}: ${result.totalDuration.toFixed(1)}s total, ${clips.length} clips. ${warnings.length > 0 ? `${warnings.length} warnings.` : 'No issues.'}`,
      },
      metadata: {
        assetCount: assets.length,
        totalDuration: result.totalDuration,
        targetFormat: target.name,
        fitMethod: operation,
        cutCount: clips.filter(c => c.operation === 'cut').length,
        loopCount: clips.filter(c => c.operation === 'loop').length,
      },
    };
  },
};

function getConversionParams(
  srcW: number, srcH: number,
  targetW: number, targetH: number,
  operation: string,
): Record<string, number> {
  const srcAspect = srcW / srcH;
  const targetAspect = targetW / targetH;

  switch (operation) {
    case 'letterbox': {
      // Scale to fit, add black bars
      const scale = Math.min(targetW / srcW, targetH / srcH);
      return { scale, barHorizontal: (targetW - srcW * scale) / 2, barVertical: (targetH - srcH * scale) / 2 };
    }
    case 'crop': {
      // Scale to fill, crop overflow
      const scale = Math.max(targetW / srcW, targetH / srcH);
      return { scale, cropX: (srcW * scale - targetW) / 2, cropY: (srcH * scale - targetH) / 2 };
    }
    case 'scale':
      return { scaleX: targetW / srcW, scaleY: targetH / srcH };
    case 'stretch':
      return { aspectRatio: targetAspect };
    case 'cut':
      return { cutAt: 1 };
    case 'loop':
      return { loopCount: 1 };
    default:
      return {};
  }
}
