/**
 * POST /api/video/create
 *
 * Takes an array of base64 image data URLs and assembles them into an MP4
 * slideshow using ffmpeg. Returns a URL to the resulting video.
 *
 * Body: {
 *   frames: string[];          // base64 data URLs (image/png or image/jpeg)
 *   duration?: number;         // seconds per frame (default 2)
 *   transition?: 'fade' | 'none'; // default 'fade'
 *   audio?: string;            // optional base64 audio data URL
 *   outputFormat?: { width: number; height: number; fps: number };
 *   platform?: string;         // 'tiktok' | 'instagram' | 'youtube' | 'twitter'
 * }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import Ffmpeg from 'fluent-ffmpeg';
import { getFfmpegPath, getFfprobePath } from '@/lib/media/ffmpegPath';

Ffmpeg.setFfmpegPath(getFfmpegPath());
Ffmpeg.setFfprobePath(getFfprobePath());

// Platform-specific output presets
const PLATFORM_PRESETS: Record<string, { width: number; height: number; fps: number }> = {
  tiktok:    { width: 1080, height: 1920, fps: 30 },
  instagram: { width: 1080, height: 1080, fps: 30 },
  youtube:   { width: 1920, height: 1080, fps: 30 },
  twitter:   { width: 1280, height: 720,  fps: 30 },
  default:   { width: 1280, height: 720,  fps: 24 },
};

export const config = { api: { bodyParser: { sizeLimit: '50mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    frames,
    duration = 2,
    transition = 'fade',
    audio,
    platform = 'default',
    outputFormat,
  } = req.body as {
    frames: string[];
    duration?: number;
    transition?: string;
    audio?: string;
    platform?: string;
    outputFormat?: { width: number; height: number; fps: number };
  };

  if (!frames || frames.length === 0) {
    return res.status(400).json({ error: 'At least one frame is required' });
  }

  const preset = outputFormat ?? PLATFORM_PRESETS[platform] ?? PLATFORM_PRESETS.default;
  const tmpDir = path.join(os.tmpdir(), `ars-video-${uuidv4()}`);
  const outDir = path.join(process.cwd(), 'public', 'exports');

  try {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.mkdir(outDir, { recursive: true });

    // Write frames to disk
    const framePaths: string[] = [];
    for (let i = 0; i < frames.length; i++) {
      const dataUrl = frames[i];
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buf = Buffer.from(base64, 'base64');
      const ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
      const framePath = path.join(tmpDir, `frame_${String(i).padStart(4, '0')}.${ext}`);
      await fs.writeFile(framePath, buf);
      framePaths.push(framePath);
    }

    // Write audio if provided
    let audioPath: string | null = null;
    if (audio) {
      const audioBuf = Buffer.from(audio.replace(/^data:audio\/\w+;base64,/, ''), 'base64');
      audioPath = path.join(tmpDir, 'audio.mp3');
      await fs.writeFile(audioPath, audioBuf);
    }

    const outputName = `video-${uuidv4()}.mp4`;
    const outputPath = path.join(outDir, outputName);

    // Build ffmpeg concat demuxer file
    const concatFile = path.join(tmpDir, 'concat.txt');
    const concatLines = framePaths
      .map((p) => `file '${p}'\nduration ${duration}`)
      .join('\n');
    // Add last frame again (concat demuxer needs final file without duration)
    const lastFrame = framePaths.at(-1)!;
    await fs.writeFile(concatFile, `${concatLines}\nfile '${lastFrame}'\n`);

    await new Promise<void>((resolve, reject) => {
      let cmd = Ffmpeg()
        .input(concatFile)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .videoFilters(
          transition === 'fade'
            ? [`scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2`]
            : [`scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2`]
        )
        .outputOptions([
          '-r', String(preset.fps),
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
        ]);

      if (audioPath) {
        cmd = cmd.input(audioPath).audioCodec('aac').audioBitrate('128k').outputOptions(['-shortest']);
      }

      cmd.output(outputPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });

    // Clean up temp dir
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => { /* best effort */ });

    return res.status(200).json({
      url: `/exports/${outputName}`,
      filename: outputName,
      width: preset.width,
      height: preset.height,
      fps: preset.fps,
      frameCount: frames.length,
    });
  } catch (err) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => { /* */ });
    console.error('[video/create]', err);
    return res.status(500).json({ error: 'Video creation failed', detail: String(err) });
  }
}
