import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';

const FFMPEG_PATH = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH || '/usr/bin/ffprobe';

ffmpeg.setFfmpegPath(FFMPEG_PATH);
ffmpeg.setFfprobePath(FFPROBE_PATH);

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  codec: string;
  bitrate: number;
  fps: number;
}

export async function probeVideo(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const video = metadata.streams.find((s) => s.codec_type === 'video');
      resolve({
        duration: metadata.format.duration || 0,
        width: video?.width || 0,
        height: video?.height || 0,
        codec: video?.codec_name || 'unknown',
        bitrate: parseInt(String(metadata.format.bit_rate || 0)),
        fps: eval(video?.r_frame_rate || '0') || 0,
      });
    });
  });
}

export async function generateVideoThumbnail(
  inputPath: string,
  outputPath: string,
  timeOffset = 1
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: [timeOffset],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '400x?',
      })
      .on('end', resolve)
      .on('error', reject);
  });
}

export async function generateVideoPreview(
  inputPath: string,
  outputPath: string,
  duration = 10
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-t', String(duration),
        '-vf', 'scale=-2:720',
        '-c:v', 'libvpx-vp9',
        '-b:v', '1M',
        '-an',
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

export async function transcodeVideo(
  inputPath: string,
  outputPath: string,
  options: { width?: number; height?: number; codec?: string; bitrate?: string } = {}
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath);
    if (options.width || options.height) {
      cmd = cmd.size(`${options.width || '?'}x${options.height || '?'}`);
    }
    if (options.codec) cmd = cmd.videoCodec(options.codec);
    if (options.bitrate) cmd = cmd.videoBitrate(options.bitrate);

    cmd.output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}
