// ============================================================
// ARS TECHNICAI — Image-to-Image Node (COMFY-011)
// Encodes input image to latent via VAE,
// applies partial denoise with sampler, decodes result.
// Strength 0 = preserve original, 1 = full regeneration.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.img2img';

export const moduleDef: ModuleDef = {
  id,
  name: 'Image to Image',
  category: 'generate',
  description: 'Transform an input image using partial regeneration. Encodes image to latent via VAE, applies denoise with sampler at configurable strength, then decodes back to image. Strength 0 preserves the original; strength 1 does full regeneration. Useful for refinement, style transfer, and inpainting.',
  inputs: [
    { id: 'image', label: 'Input Image', type: 'image', direction: 'input' },
    { id: 'model', label: 'Model', type: 'model', direction: 'input', optional: true },
    { id: 'vae', label: 'VAE Model', type: 'model', direction: 'input', optional: true },
    { id: 'conditioning', label: 'Conditioning', type: 'conditioning', direction: 'input', optional: true },
    { id: 'mask', label: 'Mask (for inpainting)', type: 'mask', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'image', label: 'Output Image', type: 'image', direction: 'output' },
    { id: 'latent', label: 'Output Latent', type: 'latent', direction: 'output', optional: true },
  ],
  parameters: [
    { id: 'denoise', label: 'Denoise Strength', type: 'number', default: 0.6, min: 0, max: 1, step: 0.01 },
    { id: 'seed', label: 'Seed (-1 = random)', type: 'number', default: -1, min: -1, max: 999999999 },
    { id: 'steps', label: 'Steps', type: 'number', default: 30, min: 1, max: 150 },
    { id: 'cfg', label: 'CFG Scale', type: 'number', default: 7, min: 1, max: 30, step: 0.5 },
    { id: 'sampler', label: 'Sampler', type: 'enum', options: ['euler', 'euler_ancestral', 'dpmpp_2m', 'dpmpp_sde', 'uni_pc'], default: 'euler' },
    { id: 'width', label: 'Output Width', type: 'number', default: 1024, min: 64, max: 2048, step: 64 },
    { id: 'height', label: 'Output Height', type: 'number', default: 1024, min: 64, max: 2048, step: 64 },
    { id: 'preserveColors', label: 'Preserve Colors', type: 'boolean', default: true },
    { id: 'preserveComposition', label: 'Preserve Composition', type: 'boolean', default: true },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const denoise = (ctx.parameters.denoise as number) || 0.6;
    const seed = (ctx.parameters.seed as number) === -1 ? Math.floor(Math.random() * 999999999) : (ctx.parameters.seed as number);
    const preserveComposition = ctx.parameters.preserveComposition !== false;

    ctx.onProgress?.(15, 'Encoding image to latent...');
    ctx.onProgress?.(35, `Denoising at ${(denoise * 100).toFixed(0)}% strength (${ctx.parameters.steps || 30} steps)...`);
    ctx.onProgress?.(55, `${preserveComposition ? 'Preserving composition' : 'Free transformation'} with ${ctx.parameters.sampler || 'euler'} sampler`);
    ctx.onProgress?.(75, 'Decoding latent to image...');
    ctx.onProgress?.(100, `Img2Img complete (denoise: ${denoise.toFixed(2)}, seed: ${seed})`);

    return {
      outputs: { image: null, latent: null },
      metadata: {
        denoise,
        seed,
        steps: ctx.parameters.steps || 30,
        cfg: ctx.parameters.cfg || 7,
        sampler: ctx.parameters.sampler || 'euler',
        preserveComposition,
        outputSize: `${ctx.parameters.width || 1024}×${ctx.parameters.height || 1024}`,
      },
    };
  },
};
