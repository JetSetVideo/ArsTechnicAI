// ============================================================
// ARS TECHNICAI — Illustration-to-Video Pipeline (ART-018)
// Bring story illustrations to life: Ken Burns effect,
// parallax depth, transitions, TTS narration, music sync.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'asm.illustration.video';

export interface VideoFrame {
  illustrationId: string;
  imageUrl: string;
  startTime: number;    // seconds
  endTime: number;
  effect: 'ken-burns' | 'parallax' | 'static' | 'pan-left' | 'pan-right' | 'zoom-in' | 'zoom-out';
  narrationText: string;
  caption: string;
}

export interface VideoConfig {
  title: string;
  frames: VideoFrame[];
  totalDuration: number;
  fps: number;
  width: number;
  height: number;
  backgroundMusic?: string;
  transitionType: 'fade' | 'dissolve' | 'none';
  transitionDuration: number;
  outputFormat: 'mp4' | 'webm';
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Illustration to Video',
  category: 'assembly',
  description: 'Convert story illustrations into a video with Ken Burns effect (slow zoom/pan), parallax depth from foreground/background layers, fade transitions between scenes, TTS narration synced to illustrations, and auto-selected background music matching scene mood.',
  inputs: [
    { id: 'illustrations', label: 'Illustration URLs', type: 'data', direction: 'input' },
    { id: 'narration', label: 'Narration Text per Scene', type: 'data', direction: 'input', optional: true },
    { id: 'music', label: 'Background Music URL', type: 'audio', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'videoConfig', label: 'Video Configuration', type: 'data', direction: 'output' },
    { id: 'timeline', label: 'Frame Timeline', type: 'data', direction: 'output' },
    { id: 'previewScript', label: 'Preview Script', type: 'text', direction: 'output' },
  ],
  parameters: [
    { id: 'effect', label: 'Animation Effect', type: 'enum', options: ['ken-burns', 'parallax', 'static', 'pan-left', 'pan-right', 'zoom-in', 'zoom-out'], default: 'ken-burns' },
    { id: 'fps', label: 'Frames Per Second', type: 'number', default: 24, min: 12, max: 60 },
    { id: 'secondsPerFrame', label: 'Seconds Per Frame', type: 'number', default: 5, min: 2, max: 15 },
    { id: 'transitionType', label: 'Transition', type: 'enum', options: ['fade', 'dissolve', 'none'], default: 'fade' },
    { id: 'transitionDuration', label: 'Transition Duration (s)', type: 'number', default: 1, min: 0.2, max: 3, step: 0.1 },
    { id: 'width', label: 'Video Width', type: 'number', default: 1920, min: 640, max: 4096, step: 64 },
    { id: 'height', label: 'Video Height', type: 'number', default: 1080, min: 360, max: 2160, step: 64 },
    { id: 'includeNarration', label: 'Include Narration Text', type: 'boolean', default: true },
    { id: 'outputFormat', label: 'Output Format', type: 'enum', options: ['mp4', 'webm'], default: 'mp4' },
    { id: 'title', label: 'Video Title', type: 'string', default: 'My Story' },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const illustrations = (ctx.inputs.illustrations as any[]) || [];
    const narrations = (ctx.inputs.narration as any[]) || [];
    const effect = (ctx.parameters.effect as string) || 'ken-burns';
    const fps = (ctx.parameters.fps as number) || 24;
    const secPerFrame = (ctx.parameters.secondsPerFrame as number) || 5;
    const transType = (ctx.parameters.transitionType as string) || 'fade';
    const transDur = (ctx.parameters.transitionDuration as number) || 1;
    const width = (ctx.parameters.width as number) || 1920;
    const height = (ctx.parameters.height as number) || 1080;

    if (illustrations.length === 0) {
      return { outputs: { videoConfig: null, timeline: [], previewScript: 'No illustrations provided.' }, metadata: { frameCount: 0 } };
    }

    // Build frame timeline
    const frames: VideoFrame[] = [];
    let currentTime = 0;

    for (let i = 0; i < illustrations.length; i++) {
      const img = illustrations[i];
      const startTime = currentTime;
      const endTime = currentTime + secPerFrame + (i < illustrations.length - 1 ? transDur : 0);

      frames.push({
        illustrationId: img.id || `img-${i}`,
        imageUrl: img.imageUrl || img.dataUrl || '',
        startTime,
        endTime,
        effect: i === 0 ? 'zoom-in' : effect as VideoFrame['effect'],
        narrationText: narrations[i]?.text || img.caption || '',
        caption: img.title || `Scene ${i + 1}`,
      });

      currentTime = endTime;
    }

    const totalDuration = currentTime;

    const config: VideoConfig = {
      title: (ctx.parameters.title as string) || 'My Story',
      frames,
      totalDuration,
      fps,
      width,
      height,
      transitionType: transType as VideoConfig['transitionType'],
      transitionDuration: transDur,
      outputFormat: (ctx.parameters.outputFormat as 'mp4' | 'webm') || 'mp4',
    };

    // Generate preview script (what the renderer would execute)
    const previewScript = generatePreviewScript(config);

    return {
      outputs: { videoConfig: config, timeline: frames, previewScript },
      metadata: {
        frameCount: frames.length,
        totalDuration,
        estimatedFileSize: `${Math.round(totalDuration * 8)}MB (approx)`,
        effect,
      },
    };
  },
};

function generatePreviewScript(config: VideoConfig): string {
  const lines: string[] = [
    `# Video: "${config.title}"`,
    `# Duration: ${config.totalDuration.toFixed(1)}s, ${config.fps}fps, ${config.width}×${config.height}`,
    `# Format: ${config.outputFormat}, Transitions: ${config.transitionType} ${config.transitionDuration}s`,
    '',
  ];

  for (const frame of config.frames) {
    const dur = (frame.endTime - frame.startTime).toFixed(1);
    lines.push(`[${frame.startTime.toFixed(1)}s-${frame.endTime.toFixed(1)}s] ${frame.caption}`);
    lines.push(`  Effect: ${frame.effect}`);
    lines.push(`  Image: ${frame.imageUrl}`);
    if (frame.narrationText) {
      lines.push(`  Narration: "${frame.narrationText.slice(0, 100)}${frame.narrationText.length > 100 ? '…' : ''}"`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
