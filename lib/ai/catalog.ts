// Client-safe model catalog — no Node.js APIs, safe to import in browser components

export interface ModelDef {
  id: string;
  name: string;
  description: string;
  supportsNegative: boolean;
  supportsSteps: boolean;
  supportsGuidance: boolean;
}

export const GOOGLE_MODELS: ModelDef[] = [
  { id: 'imagen-3.0-generate-002',        name: 'Imagen 3',       description: 'Highest quality · detailed',     supportsNegative: false, supportsSteps: false, supportsGuidance: false },
  { id: 'imagen-4.0-fast-generate-001',   name: 'Imagen 4 Fast',  description: 'Fast generation',               supportsNegative: false, supportsSteps: false, supportsGuidance: false },
  { id: 'imagen-4.0-generate-001',        name: 'Imagen 4',       description: 'Balanced quality & speed',       supportsNegative: false, supportsSteps: false, supportsGuidance: false },
  { id: 'imagen-4.0-ultra-generate-001',  name: 'Imagen 4 Ultra', description: 'Best quality · slowest',        supportsNegative: false, supportsSteps: false, supportsGuidance: false },
];

export const DALLE_MODELS: ModelDef[] = [
  { id: 'dall-e-3', name: 'DALL·E 3', description: 'Latest · best prompt following', supportsNegative: false, supportsSteps: false, supportsGuidance: false },
  { id: 'dall-e-2', name: 'DALL·E 2', description: 'Faster · lower cost',            supportsNegative: false, supportsSteps: false, supportsGuidance: false },
];

export const STABILITY_MODELS: ModelDef[] = [
  { id: 'sd3.5-large',                       name: 'SD 3.5 Large', description: 'Latest · best quality',   supportsNegative: true, supportsSteps: true, supportsGuidance: true },
  { id: 'sd3-large',                         name: 'SD 3 Large',   description: 'Balanced quality',        supportsNegative: true, supportsSteps: true, supportsGuidance: true },
  { id: 'sd3-medium',                        name: 'SD 3 Medium',  description: 'Faster · lower cost',     supportsNegative: true, supportsSteps: true, supportsGuidance: true },
  { id: 'stable-diffusion-xl-1024-v1-0',    name: 'SDXL 1.0',    description: 'Classic · negative prompt',supportsNegative: true, supportsSteps: true, supportsGuidance: true },
];

export const FAL_MODELS: ModelDef[] = [
  { id: 'fal-ai/flux/schnell',   name: 'Flux Schnell',  description: 'Fastest · 4 steps · free tier',    supportsNegative: false, supportsSteps: false, supportsGuidance: false },
  { id: 'fal-ai/flux/dev',       name: 'Flux Dev',      description: 'Balanced quality & speed',          supportsNegative: false, supportsSteps: true,  supportsGuidance: true  },
  { id: 'fal-ai/flux-pro',       name: 'Flux Pro',      description: 'Highest quality · commercial',      supportsNegative: false, supportsSteps: false, supportsGuidance: true  },
  { id: 'fal-ai/flux-pro/v1.1',  name: 'Flux Pro 1.1',  description: 'Latest pro · faster & sharper',    supportsNegative: false, supportsSteps: false, supportsGuidance: false },
  { id: 'fal-ai/stable-diffusion-xl', name: 'SDXL',    description: 'SDXL · negative prompt support',    supportsNegative: true,  supportsSteps: true,  supportsGuidance: true  },
  { id: 'fal-ai/flux-realism',   name: 'Flux Realism',  description: 'Photorealistic · LoRA enhanced',   supportsNegative: false, supportsSteps: true,  supportsGuidance: false },
];

export const REPLICATE_MODELS: ModelDef[] = [
  { id: 'black-forest-labs/flux-schnell', name: 'Flux Schnell',   description: 'Ultra-fast · 4 steps',         supportsNegative: false, supportsSteps: false, supportsGuidance: false },
  { id: 'black-forest-labs/flux-dev',     name: 'Flux Dev',       description: 'Balanced quality & speed',      supportsNegative: false, supportsSteps: true,  supportsGuidance: true  },
  { id: 'stability-ai/sdxl',              name: 'SDXL',           description: 'SDXL 1.0 · negative prompt',   supportsNegative: true,  supportsSteps: true,  supportsGuidance: true  },
  { id: 'ideogram-ai/ideogram-v2',        name: 'Ideogram v2',    description: 'Great at text in images',       supportsNegative: true,  supportsSteps: false, supportsGuidance: false },
  { id: 'recraft-ai/recraft-v3',          name: 'Recraft v3',     description: 'Vector & SVG friendly',         supportsNegative: false, supportsSteps: false, supportsGuidance: false },
];

export const ALL_MODELS: Record<string, ModelDef[]> = {
  GOOGLE_IMAGEN: GOOGLE_MODELS,
  OPENAI_DALLE:  DALLE_MODELS,
  STABILITY:     STABILITY_MODELS,
  FAL:           FAL_MODELS,
  REPLICATE:     REPLICATE_MODELS,
};
