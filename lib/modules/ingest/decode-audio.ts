// ============================================================
// ARS TECHNICAI — Audio Decoder Module
// Phase 1.4: Decode audio + extract waveform peaks
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.decode.audio';

export interface AudioMeta {
  duration: number;
  sampleRate: number;
  channels: number;
  bitrate: number;
  codec: string;
  format: string;
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Audio Decoder',
  category: 'ingest',
  description: 'Decode audio Blob via Web Audio API and extract waveform peak data',
  library: 'Web Audio API (client) / fluent-ffmpeg (server)',
  inputs: [
    { id: 'file', name: 'File', type: 'data', required: true, description: 'Audio Blob or File' },
  ],
  outputs: [
    { id: 'audio', name: 'Audio', type: 'audio', description: 'AudioBuffer' },
    { id: 'waveform', name: 'Waveform', type: 'data', description: 'Float32Array of peak samples' },
    { id: 'metadata', name: 'Metadata', type: 'data', description: 'AudioMeta object' },
  ],
  parameters: [
    { id: 'peakCount', name: 'Peak Count', type: 'number', default: 200, description: 'Number of waveform peaks to extract' },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const file = ctx.inputs.file as File | Blob | undefined;
    if (!file) {
      return { outputs: {}, error: 'No audio file provided' };
    }

    const blob = file instanceof File ? file : new File([file], 'audio', { type: 'audio/wav' });
    const arrayBuffer = await blob.arrayBuffer();

    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const metadata: AudioMeta = {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      bitrate: 0,
      codec: 'unknown',
      format: blob.type.replace('audio/', '') || 'unknown',
    };

    // Extract waveform peaks
    const peakCount = (ctx.params.peakCount as number) ?? 200;
    const peaks = extractPeaks(audioBuffer, peakCount);

    return {
      outputs: {
        audio: audioBuffer,
        waveform: peaks,
        metadata,
      },
      logs: [`Decoded audio: ${metadata.duration.toFixed(1)}s, ${metadata.sampleRate}Hz, ${metadata.channels}ch`],
    };
  },
};

function extractPeaks(audioBuffer: AudioBuffer, peakCount: number): Float32Array {
  const channelData = audioBuffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / peakCount);
  const peaks = new Float32Array(peakCount);

  for (let i = 0; i < peakCount; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, channelData.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }
    peaks[i] = max;
  }

  return peaks;
}
