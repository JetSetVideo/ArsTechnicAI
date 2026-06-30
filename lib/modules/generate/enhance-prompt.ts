// ============================================================
// ARS TECHNICAI — Enhance Prompt Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.enhance-prompt';

export const moduleDef: ModuleDef = {
  id,
  name: 'Enhance Prompt',
  category: 'generate',
  description: 'Improve text prompts with cinematic details and quality keywords.',
  inputs: [
    { id: 'prompt', label: 'Prompt', type: 'text', direction: 'input', optional: true },
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
    { id: 'params', label: 'Params', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'mode', label: 'Mode', type: 'enum', default: 'cinematic', options: ['cinematic', 'photographic', 'artistic', 'minimal', 'detailed'] },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const prompt = (ctx.inputs.prompt as string) || '';
    const mode = (ctx.parameters.mode as string) || 'cinematic';
    const suffixes: Record<string, string> = {
      cinematic: 'cinematic lighting, shallow depth of field, anamorphic lens, film grain, 8K',
      photographic: 'professional photography, sharp focus, natural lighting, high detail, 8K',
      artistic: 'artistic composition, vibrant colors, expressive style, gallery quality',
      minimal: 'clean composition, minimal background, studio lighting, sharp focus, 4K',
      detailed: 'ultra detailed, hyperrealistic, intricate textures, macro photography, 8K HDR',
    };
    const enhanced = prompt ? `${prompt}, ${suffixes[mode] || suffixes.cinematic}` : 'A beautiful cinematic photograph, 8K resolution';
    return { outputs: { enhancedPrompt: enhanced, originalPrompt: prompt }, metadata: { mode } };
  },
};
