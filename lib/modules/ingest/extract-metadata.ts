// ============================================================
// ARS TECHNICAI — Metadata Extractor Module
// Phase 1.6: Extract metadata + thumbnail from any Asset type
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.extract.metadata';

export const moduleDef: ModuleDef = {
  id,
  name: 'Metadata Extractor',
  category: 'ingest',
  description: 'Extract metadata and thumbnail from any Asset (image, video, audio, 3D)',
  library: 'sharp / fluent-ffmpeg / lib/media/processor.ts',
  inputs: [
    { id: 'asset', name: 'Asset', type: 'data', required: true, description: 'Asset to analyze' },
  ],
  outputs: [
    { id: 'metadata', name: 'Metadata', type: 'data', description: 'Structured metadata object' },
    { id: 'thumbnail', name: 'Thumbnail', type: 'image', description: 'Thumbnail data URL or path' },
  ],
  parameters: [
    { id: 'extractPalette', name: 'Extract Color Palette', type: 'boolean', default: false },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const asset = ctx.inputs.asset as { type: string; thumbnail?: string; metadata?: Record<string, unknown> } | undefined;
    if (!asset) {
      return { outputs: {}, error: 'No asset provided' };
    }

    const metadata = asset.metadata || {};

    return {
      outputs: {
        metadata,
        thumbnail: asset.thumbnail,
      },
      logs: [`Extracted metadata for ${asset.type} asset`],
    };
  },
};
