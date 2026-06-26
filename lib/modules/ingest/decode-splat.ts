// ============================================================
// ARS TECHNICAI — Gaussian Splat Loader Module
// Phase 1: Load .ply / .splat files
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.decode.splat';

export interface SplatScene {
  src: string;
  format: 'ply' | 'splat';
  vertexCount: number;
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Gaussian Splat Loader',
  category: 'ingest',
  description: 'Load Gaussian Splat scene (.ply or .splat)',
  library: '@sparkjsdev/spark or three-gaussian-splatting',
  inputs: [
    { id: 'file', name: 'File', type: 'data', required: true, description: '.ply or .splat Blob' },
  ],
  outputs: [
    { id: 'splat', name: 'Splat Scene', type: '3d', description: 'SplatScene reference' },
  ],
  parameters: [],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const file = ctx.inputs.file as File | Blob | undefined;
    if (!file) {
      return { outputs: {}, error: 'No splat file provided' };
    }

    const f = file instanceof File ? file : new File([file], 'scene.ply');
    const ext = f.name.split('.').pop()?.toLowerCase() || 'ply';
    const format = ext === 'splat' ? 'splat' : 'ply';

    const splat: SplatScene = {
      src: URL.createObjectURL(f),
      format,
      vertexCount: 0, // Will be populated by renderer in Phase 5
    };

    return {
      outputs: { splat },
      logs: [`Loaded Gaussian Splat: ${f.name} (${format.toUpperCase()})`],
    };
  },
};
