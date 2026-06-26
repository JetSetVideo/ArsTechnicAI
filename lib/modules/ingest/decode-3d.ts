// ============================================================
// ARS TECHNICAI — 3D Model Loader Module
// Phase 1: Load GLTF/GLB/OBJ/FBX metadata
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.decode.3d';

export interface Model3DMeta {
  format: 'glb' | 'gltf' | 'obj' | 'fbx';
  vertices: number;
  materials: number;
  hasAnimations: boolean;
  boundingBox: { min: [number, number, number]; max: [number, number, number] };
}

export const moduleDef: ModuleDef = {
  id,
  name: '3D Model Loader',
  category: 'ingest',
  description: 'Load 3D model and extract metadata (GLTF, GLB, OBJ, FBX)',
  library: 'three.js loaders',
  inputs: [
    { id: 'file', name: 'File', type: 'data', required: true, description: '3D model Blob or File' },
  ],
  outputs: [
    { id: 'scene', name: 'Scene', type: '3d', description: 'Scene3D reference' },
    { id: 'metadata', name: 'Metadata', type: 'data', description: 'Model3DMeta object' },
  ],
  parameters: [],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const file = ctx.inputs.file as File | Blob | undefined;
    if (!file) {
      return { outputs: {}, error: 'No 3D model file provided' };
    }

    const f = file instanceof File ? file : new File([file], 'model.glb');
    const ext = f.name.split('.').pop()?.toLowerCase() || 'glb';
    const format = (['glb', 'gltf', 'obj', 'fbx'].includes(ext) ? ext : 'glb') as Model3DMeta['format'];

    // Stub — full Three.js parsing in Phase 5
    const metadata: Model3DMeta = {
      format,
      vertices: 0,
      materials: 0,
      hasAnimations: false,
      boundingBox: { min: [0, 0, 0], max: [0, 0, 0] },
    };

    return {
      outputs: {
        scene: { src: URL.createObjectURL(f), format },
        metadata,
      },
      logs: [`Loaded 3D model: ${f.name} (${format.toUpperCase()})`],
    };
  },
};
