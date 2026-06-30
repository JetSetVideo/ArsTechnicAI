/**
 * Cross-platform ffmpeg/ffprobe path resolver.
 *
 * Priority:
 * 1. FFMPEG_PATH / FFPROBE_PATH env vars (explicit override)
 * 2. Platform-specific known locations
 * 3. Falls back to bare binary name (resolved via PATH)
 */

import { execFileSync } from 'child_process';

const isWindows = process.platform === 'win32';
const isMac    = process.platform === 'darwin';

// Candidate paths ordered by likelihood per platform
const FFMPEG_CANDIDATES = isMac
  ? ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg']  // M1 Homebrew first
  : isWindows
    ? ['C:\\ffmpeg\\bin\\ffmpeg.exe']
    : ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'];

const FFPROBE_CANDIDATES = isMac
  ? ['/opt/homebrew/bin/ffprobe', '/usr/local/bin/ffprobe', '/usr/bin/ffprobe']
  : isWindows
    ? ['C:\\ffmpeg\\bin\\ffprobe.exe']
    : ['/usr/bin/ffprobe', '/usr/local/bin/ffprobe'];

function probe(candidates: string[]): string {
  for (const p of candidates) {
    try {
      execFileSync(p, ['-version'], { stdio: 'ignore' });
      return p;
    } catch { /* not found at this path */ }
  }
  // Last resort — rely on PATH
  return candidates[0].split('/').pop() ?? 'ffmpeg';
}

let _ffmpegPath: string | null = null;
let _ffprobePath: string | null = null;

export function getFfmpegPath(): string {
  if (!_ffmpegPath) {
    _ffmpegPath = process.env.FFMPEG_PATH || probe(FFMPEG_CANDIDATES);
  }
  return _ffmpegPath;
}

export function getFfprobePath(): string {
  if (!_ffprobePath) {
    _ffprobePath = process.env.FFPROBE_PATH || probe(FFPROBE_CANDIDATES);
  }
  return _ffprobePath;
}
