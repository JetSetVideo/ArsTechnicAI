import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';

const FFMPEG_PATH = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH || '/usr/bin/ffprobe';

ffmpeg.setFfmpegPath(FFMPEG_PATH);
ffmpeg.setFfprobePath(FFPROBE_PATH);

export interface AudioMetadata {
  duration: number;
  codec: string;
  sampleRate: number;
  channels: number;
  bitrate: number;
}

export async function probeAudio(filePath: string): Promise<AudioMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const audio = metadata.streams.find((s) => s.codec_type === 'audio');
      resolve({
        duration: metadata.format.duration || 0,
        codec: audio?.codec_name || 'unknown',
        sampleRate: audio?.sample_rate ? parseInt(String(audio.sample_rate)) : 0,
        channels: audio?.channels || 0,
        bitrate: parseInt(String(metadata.format.bit_rate || 0)),
      });
    });
  });
}

export async function generateWaveform(
  inputPath: string,
  outputPath: string,
  width = 800,
  height = 200
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-filter_complex',
        `showwavespic=s=${width}x${height}:colors=#00d4aa`,
        '-frames:v', '1',
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

export async function transcodeAudio(
  inputPath: string,
  outputPath: string,
  options: { codec?: string; bitrate?: string; normalize?: boolean } = {}
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath);
    if (options.codec) cmd = cmd.audioCodec(options.codec);
    if (options.bitrate) cmd = cmd.audioBitrate(options.bitrate);
    if (options.normalize) {
      cmd = cmd.audioFilters('loudnorm=I=-14:LRA=11:TP=-1');
    }

    cmd.output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}
