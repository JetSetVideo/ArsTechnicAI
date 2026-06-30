// ============================================================
// ARS TECHNICAI — Storyboard Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.storyboard';

export const moduleDef: ModuleDef = {
  id,
  name: 'Storyboard',
  category: 'generate',
  description: 'Generate visual storyboard from creative concepts.',
  inputs: [
    { id: 'prompt', label: 'Prompt', type: 'text', direction: 'input', optional: true },
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
    { id: 'params', label: 'Params', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'scenes', label: 'Scenes', type: 'number', default: 6, min: 2, max: 24 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const n = (ctx.parameters.scenes as number) || 6;
    const scenes = Array.from({length: n}, (_, i) => ({id: `scene-${i+1}`, title: `Scene ${i+1}`, type: ['wide','medium','close-up'][i%3], duration: 4+i*2}));
    return { outputs: { storyboard: {scenes} }, metadata: {sceneCount: n} };
  },
};
