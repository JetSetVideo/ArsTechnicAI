// ============================================================
// ARS TECHNICAI — Audio Waveform Extractor Module
// Phase 1.6: Extract peak waveform data from audio
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.extract.waveform';

export const moduleDef: ModuleDef = {
  id,
  name: 'Audio Waveform',
  category: 'ingest',
  description: 'Extract peak waveform data from an AudioBuffer for timeline display',
  library: 'Web Audio API',
  inputs: [
    { id: 'audio', name: 'Audio', type: 'audio', required: true, description: 'AudioBuffer' },
  ],
  outputs: [
    { id: 'peaks', name: 'Peaks', type: 'data', description: 'Float32Array of peak amplitudes' },
  ],
  parameters: [
    { id: 'peakCount', name: 'Peak Count', type: 'number', default: 400 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const audioBuffer = ctx.inputs.audio as AudioBuffer | undefined;
    if (!audioBuffer) {
      return { outputs: {}, error: 'No audio buffer provided for waveform extraction' };
    }

    const peakCount = (ctx.params.peakCount as number) ?? 400;
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

    return {
      outputs: { peaks },
      logs: [`Extracted ${peakCount} waveform peaks from ${audioBuffer.duration.toFixed(1)}s audio`],
    };
  },
};
