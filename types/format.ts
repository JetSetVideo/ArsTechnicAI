// ============================================================
// ARS TECHNICAI — Format & Export Types
// Phase 0.3: Format profiles for all platforms
// ============================================================

export type AspectRatio =
  | '1:1'
  | '3:4'
  | '4:3'
  | '4:5'
  | '9:16'
  | '16:9'
  | '21:9'
  | '2.39:1';

export type VideoCodec = 'H.264' | 'H.265' | 'VP9' | 'AV1' | 'ProRes';
export type AudioCodec = 'AAC' | 'MP3' | 'FLAC' | 'PCM';
export type ImageCodec = 'JPEG' | 'PNG' | 'WebP' | 'TIFF';
export type ContainerFormat = 'MP4' | 'WebM' | 'MOV' | 'MKV' | 'AVI';

export interface FormatProfile {
  id: string;
  name: string;
  platform: string;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  maxDuration?: number; // seconds
  maxFileSize?: number; // bytes
  videoCodec?: VideoCodec;
  audioCodec?: AudioCodec;
  imageCodec?: ImageCodec;
  container?: ContainerFormat;
  videoBitrate?: string; // e.g. "8M"
  audioBitrate?: string; // e.g. "192k"
  fps?: number;
  colorSpace?: 'sRGB' | 'Rec. 709' | 'Rec. 2020' | 'DCI-P3';
  audioChannels?: number;
  audioSampleRate?: number;
}

export interface ExportSettings {
  profileId: string;
  customWidth?: number;
  customHeight?: number;
  quality: 'draft' | 'standard' | 'high' | 'maximum';
  includeAudio: boolean;
  burnSubtitles: boolean;
  watermarkPath?: string;
  outputFormat: 'mp4' | 'webm' | 'mov' | 'png-sequence' | 'gif';
}

export interface RenderJob {
  id: string;
  projectId: string;
  settings: ExportSettings;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  outputPath?: string;
  progress: number;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}
