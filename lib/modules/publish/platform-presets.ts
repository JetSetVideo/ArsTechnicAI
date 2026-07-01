// ============================================================
// ARS TECHNICAI — Platform Format Presets
// Deep format profiles per platform with safe zones, 
// aspect ratios, codec recommendations, and specs.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'pub.platform.presets';

export interface PlatformPreset {
  id: string;
  name: string;
  formats: PlatformFormat[];
}

export interface PlatformFormat {
  id: string;
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
  safeZoneInset: number;    // percentage
  maxDuration: number;      // seconds, 0 = unlimited
  maxFileSize: number;      // bytes, 0 = unlimited
  videoCodec: string;
  audioCodec: string;
  container: string;
  fps: number[];
  bitrateRecommendation: string;
}

export const PLATFORM_PRESETS: PlatformPreset[] = [
  {
    id: 'tiktok', name: 'TikTok',
    formats: [
      { id: 'tiktok-vertical', label: 'Vertical Feed', width: 1080, height: 1920, aspectRatio: '9:16', safeZoneInset: 12, maxDuration: 180, maxFileSize: 287_600_000, videoCodec: 'H.264', audioCodec: 'AAC', container: 'MP4', fps: [24, 30, 60], bitrateRecommendation: '5-8 Mbps' },
      { id: 'tiktok-square', label: 'Square Feed', width: 1080, height: 1080, aspectRatio: '1:1', safeZoneInset: 10, maxDuration: 180, maxFileSize: 200_000_000, videoCodec: 'H.264', audioCodec: 'AAC', container: 'MP4', fps: [24, 30], bitrateRecommendation: '4-6 Mbps' },
      { id: 'tiktok-story', label: 'Story', width: 1080, height: 1920, aspectRatio: '9:16', safeZoneInset: 15, maxDuration: 60, maxFileSize: 100_000_000, videoCodec: 'H.264', audioCodec: 'AAC', container: 'MP4', fps: [30], bitrateRecommendation: '3-5 Mbps' },
    ]
  },
  {
    id: 'instagram', name: 'Instagram',
    formats: [
      { id: 'ig-feed-square', label: 'Feed Square', width: 1080, height: 1080, aspectRatio: '1:1', safeZoneInset: 8, maxDuration: 60, maxFileSize: 100_000_000, videoCodec: 'H.264', audioCodec: 'AAC', container: 'MP4', fps: [30], bitrateRecommendation: '4-5 Mbps' },
      { id: 'ig-feed-portrait', label: 'Feed Portrait', width: 1080, height: 1350, aspectRatio: '4:5', safeZoneInset: 8, maxDuration: 60, maxFileSize: 100_000_000, videoCodec: 'H.264', audioCodec: 'AAC', container: 'MP4', fps: [30], bitrateRecommendation: '4-6 Mbps' },
      { id: 'ig-reels', label: 'Reels', width: 1080, height: 1920, aspectRatio: '9:16', safeZoneInset: 12, maxDuration: 90, maxFileSize: 150_000_000, videoCodec: 'H.264', audioCodec: 'AAC', container: 'MP4', fps: [30, 60], bitrateRecommendation: '5-8 Mbps' },
      { id: 'ig-stories', label: 'Stories', width: 1080, height: 1920, aspectRatio: '9:16', safeZoneInset: 15, maxDuration: 60, maxFileSize: 50_000_000, videoCodec: 'H.264', audioCodec: 'AAC', container: 'MP4', fps: [30], bitrateRecommendation: '3-5 Mbps' },
    ]
  },
  {
    id: 'youtube', name: 'YouTube',
    formats: [
      { id: 'yt-standard', label: 'Standard 1080p', width: 1920, height: 1080, aspectRatio: '16:9', safeZoneInset: 5, maxDuration: 0, maxFileSize: 0, videoCodec: 'H.264', audioCodec: 'AAC', container: 'MP4', fps: [24, 30, 60], bitrateRecommendation: '8-12 Mbps' },
      { id: 'yt-4k', label: '4K UHD', width: 3840, height: 2160, aspectRatio: '16:9', safeZoneInset: 5, maxDuration: 0, maxFileSize: 0, videoCodec: 'H.265', audioCodec: 'AAC', container: 'MP4', fps: [24, 30, 60], bitrateRecommendation: '35-45 Mbps' },
      { id: 'yt-shorts', label: 'Shorts', width: 1080, height: 1920, aspectRatio: '9:16', safeZoneInset: 12, maxDuration: 60, maxFileSize: 0, videoCodec: 'H.264', audioCodec: 'AAC', container: 'MP4', fps: [30, 60], bitrateRecommendation: '5-8 Mbps' },
    ]
  },
  {
    id: 'twitter', name: 'X / Twitter',
    formats: [
      { id: 'x-feed', label: 'Feed Video', width: 1920, height: 1080, aspectRatio: '16:9', safeZoneInset: 5, maxDuration: 140, maxFileSize: 512_000_000, videoCodec: 'H.264', audioCodec: 'AAC', container: 'MP4', fps: [30, 60], bitrateRecommendation: '5-8 Mbps' },
      { id: 'x-vertical', label: 'Vertical', width: 1080, height: 1920, aspectRatio: '9:16', safeZoneInset: 10, maxDuration: 140, maxFileSize: 512_000_000, videoCodec: 'H.264', audioCodec: 'AAC', container: 'MP4', fps: [30], bitrateRecommendation: '4-6 Mbps' },
    ]
  },
  {
    id: 'linkedin', name: 'LinkedIn',
    formats: [
      { id: 'li-feed', label: 'Feed Video', width: 1920, height: 1080, aspectRatio: '16:9', safeZoneInset: 5, maxDuration: 600, maxFileSize: 5_000_000_000, videoCodec: 'H.264', audioCodec: 'AAC', container: 'MP4', fps: [30], bitrateRecommendation: '5-8 Mbps' },
    ]
  },
];

export const moduleDef: ModuleDef = {
  id,
  name: 'Platform Format Presets',
  category: 'publish',
  description: 'Deep format profiles for all social platforms: TikTok, Instagram, YouTube, X/Twitter, LinkedIn. Includes safe zones, codec recommendations, file size limits, and aspect ratios.',
  inputs: [
    { id: 'platform', label: 'Platform', type: 'text', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'platforms', label: 'Platform Presets', type: 'data', direction: 'output' },
    { id: 'selected', label: 'Selected Platform', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'platform', label: 'Platform', type: 'enum', options: ['tiktok', 'instagram', 'youtube', 'twitter', 'linkedin', 'all'], default: 'all' },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const platform = (ctx.parameters.platform as string) || 'all';
    const selected = platform === 'all' ? PLATFORM_PRESETS : PLATFORM_PRESETS.filter(p => p.id === platform);
    return {
      outputs: { platforms: PLATFORM_PRESETS, selected },
      metadata: { platformCount: PLATFORM_PRESETS.length, formatCount: PLATFORM_PRESETS.reduce((s, p) => s + p.formats.length, 0) },
    };
  },
};
