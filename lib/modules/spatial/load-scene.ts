// ============================================================
// ARS TECHNICAI — Load 3D Scene Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'spatial.load-scene';

export const moduleDef: ModuleDef = {
  id,
  name: 'Load 3D Scene',
  category: 'spatial',
  description: 'Load 3D scenes from GLTF, GLB, OBJ, FBX files. Parse geometry, materials, animations, and lights.',
  inputs: [
    { id: 'input', label: 'Input Data', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'format', label: 'File Format', type: 'enum', default: 'glb', options: ['gltf', 'glb', 'obj', 'fbx', 'usdz'] },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    ctx.onProgress?.(50, 'Processing...');
    return {
      outputs: { result: ctx.parameters },
      metadata: { operation: 'load-scene', timestamp: Date.now() },
    };
  },
};
