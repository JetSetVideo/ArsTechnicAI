import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';
export const id = 'gen.image';

export const SAMPLERS = ['euler', 'euler_ancestral', 'heun', 'dpm_2', 'dpm_2_ancestral', 'lms', 'dpm_fast', 'dpm_adaptive', 'dpmpp_2m', 'dpmpp_sde', 'uni_pc'] as const;
export const SCHEDULERS = ['normal', 'karras', 'exponential', 'sgm_uniform', 'simple', 'ddim_uniform'] as const;

export const moduleDef: ModuleDef = {
  id, name: 'Generate Image', category: 'generate',
  description: 'Generate images from text prompts using AI. Configurable dimensions, sampler (11 types), scheduler (6 types), CFG scale, steps, seed, and denoise strength for img2img.',
  inputs: [
    { id: 'prompt', label: 'Prompt', type: 'text', direction: 'input', optional: true },
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input', optional: true },
    { id: 'conditioning', label: 'Conditioning', type: 'conditioning', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'image', label: 'Generated Image', type: 'image', direction: 'output' },
    { id: 'latent', label: 'Latent Output', type: 'latent', direction: 'output', optional: true },
    { id: 'params', label: 'Generation Params', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'prompt', label: 'Prompt', type: 'string', default: '' },
    { id: 'negativePrompt', label: 'Negative Prompt', type: 'string', default: '' },
    { id: 'width', label: 'Width', type: 'number', default: 1024, min: 256, max: 2048, step: 64 },
    { id: 'height', label: 'Height', type: 'number', default: 1024, min: 256, max: 2048, step: 64 },
    { id: 'seed', label: 'Seed (-1 = random)', type: 'number', default: -1, min: -1, max: 999999999 },
    { id: 'steps', label: 'Steps', type: 'number', default: 30, min: 1, max: 150 },
    { id: 'cfg', label: 'CFG Scale', type: 'number', default: 7, min: 1, max: 30, step: 0.5 },
    { id: 'sampler', label: 'Sampler', type: 'enum', options: [...SAMPLERS], default: 'euler' },
    { id: 'scheduler', label: 'Scheduler', type: 'enum', options: [...SCHEDULERS], default: 'normal' },
    { id: 'denoise', label: 'Denoise (img2img)', type: 'number', default: 1, min: 0, max: 1, step: 0.01 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const params = ctx.parameters;
    const seed = (params.seed as number) === -1 ? Math.floor(Math.random() * 999999999) : (params.seed as number);

    ctx.onProgress?.(25, `Sampling with ${params.sampler || 'euler'}/${params.scheduler || 'normal'}...`);
    ctx.onProgress?.(50, 'Requesting generation...');

    return {
      outputs: {
        generationParams: { ...params, seed, sampler: params.sampler || 'euler', scheduler: params.scheduler || 'normal' },
      },
      metadata: {
        note: 'Call /api/generate with these params',
        sampler: params.sampler || 'euler',
        scheduler: params.scheduler || 'normal',
        steps: params.steps || 30,
        cfg: params.cfg || 7,
      },
    };
  },
};
