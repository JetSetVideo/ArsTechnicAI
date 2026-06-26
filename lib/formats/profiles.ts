// ============================================================
// ARS TECHNICAI — Format Profiles
// Phase 0.3: Format profiles for all platforms (exportable as JSON)
// ============================================================

import type { FormatProfile } from '@/types/format';

export const FORMAT_PROFILES: FormatProfile[] = [
  // TikTok
  {
    id: 'tiktok.vertical',
    name: 'TikTok Vertical',
    platform: 'TikTok',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    maxDuration: 180,
    videoCodec: 'H.264',
    audioCodec: 'AAC',
    container: 'MP4',
    videoBitrate: '8M',
    audioBitrate: '192k',
    fps: 30,
    colorSpace: 'Rec. 709',
    audioChannels: 2,
    audioSampleRate: 48000,
  },
  // YouTube
  {
    id: 'youtube.short',
    name: 'YouTube Shorts',
    platform: 'YouTube',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    maxDuration: 60,
    videoCodec: 'H.264',
    audioCodec: 'AAC',
    container: 'MP4',
    videoBitrate: '8M',
    audioBitrate: '192k',
    fps: 30,
    colorSpace: 'Rec. 709',
    audioChannels: 2,
    audioSampleRate: 48000,
  },
  {
    id: 'youtube.standard',
    name: 'YouTube Standard',
    platform: 'YouTube',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    videoCodec: 'H.264',
    audioCodec: 'AAC',
    container: 'MP4',
    videoBitrate: '8M',
    audioBitrate: '192k',
    fps: 30,
    colorSpace: 'Rec. 709',
    audioChannels: 2,
    audioSampleRate: 48000,
  },
  {
    id: 'youtube.4k',
    name: 'YouTube 4K',
    platform: 'YouTube',
    aspectRatio: '16:9',
    width: 3840,
    height: 2160,
    videoCodec: 'H.265',
    audioCodec: 'AAC',
    container: 'MP4',
    videoBitrate: '35M',
    audioBitrate: '320k',
    fps: 60,
    colorSpace: 'Rec. 2020',
    audioChannels: 2,
    audioSampleRate: 48000,
  },
  // Instagram
  {
    id: 'instagram.reel',
    name: 'Instagram Reels',
    platform: 'Instagram',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    maxDuration: 90,
    videoCodec: 'H.264',
    audioCodec: 'AAC',
    container: 'MP4',
    videoBitrate: '8M',
    audioBitrate: '192k',
    fps: 30,
    colorSpace: 'Rec. 709',
    audioChannels: 2,
    audioSampleRate: 48000,
  },
  {
    id: 'instagram.post',
    name: 'Instagram Feed',
    platform: 'Instagram',
    aspectRatio: '1:1',
    width: 1080,
    height: 1080,
    imageCodec: 'JPEG',
    colorSpace: 'sRGB',
  },
  {
    id: 'instagram.story',
    name: 'Instagram Stories',
    platform: 'Instagram',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    maxDuration: 15,
    videoCodec: 'H.264',
    audioCodec: 'AAC',
    container: 'MP4',
    videoBitrate: '6M',
    audioBitrate: '128k',
    fps: 30,
    colorSpace: 'Rec. 709',
    audioChannels: 2,
    audioSampleRate: 48000,
  },
  // X / Twitter
  {
    id: 'twitter.video',
    name: 'X/Twitter Video',
    platform: 'Twitter',
    aspectRatio: '16:9',
    width: 1280,
    height: 720,
    maxDuration: 140,
    videoCodec: 'H.264',
    audioCodec: 'AAC',
    container: 'MP4',
    videoBitrate: '5M',
    audioBitrate: '128k',
    fps: 30,
    colorSpace: 'Rec. 709',
    audioChannels: 2,
    audioSampleRate: 48000,
  },
  {
    id: 'twitter.image',
    name: 'X/Twitter Image',
    platform: 'Twitter',
    aspectRatio: '16:9',
    width: 1200,
    height: 675,
    imageCodec: 'JPEG',
    colorSpace: 'sRGB',
  },
  // Comic
  {
    id: 'comic.page',
    name: 'Comic Page',
    platform: 'Export',
    aspectRatio: '3:4',
    width: 2480,
    height: 3508,
    imageCodec: 'PNG',
    colorSpace: 'sRGB',
  },
];

export function getProfileById(id: string): FormatProfile | undefined {
  return FORMAT_PROFILES.find((p) => p.id === id);
}

export function listProfilesByPlatform(platform: string): FormatProfile[] {
  return FORMAT_PROFILES.filter((p) => p.platform.toLowerCase() === platform.toLowerCase());
}

export function exportProfilesAsJson(): string {
  return JSON.stringify(FORMAT_PROFILES, null, 2);
}
