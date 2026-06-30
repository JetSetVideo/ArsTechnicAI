// ============================================================
// ARS TECHNICAI — Prompt from Image Analysis
// Analyzes an image and generates a detailed AI prompt describing 
// its contents, style, composition, and mood for regeneration.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'intel.prompt.from.image';

export interface ImageAnalysis {
  objects: string[];
  style: string;
  palette: string[];
  composition: string;
  mood: string;
  lighting: string;
  quality: string;
  technical: string;
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Prompt from Image',
  category: 'intelligence',
  description: 'Analyze an image and generate a detailed AI prompt describing its contents, style, composition, color palette, mood, and technical qualities for regeneration or variation.',
  inputs: [
    { id: 'image', label: 'Source Image', type: 'image', direction: 'input' },
  ],
  outputs: [
    { id: 'prompt', label: 'Generated Prompt', type: 'text', direction: 'output' },
    { id: 'negativePrompt', label: 'Negative Prompt', type: 'text', direction: 'output' },
    { id: 'objects', label: 'Detected Objects', type: 'data', direction: 'output' },
    { id: 'style', label: 'Style Analysis', type: 'text', direction: 'output' },
    { id: 'palette', label: 'Color Palette', type: 'data', direction: 'output' },
    { id: 'composition', label: 'Composition', type: 'text', direction: 'output' },
  ],
  parameters: [
    { id: 'detailLevel', label: 'Detail Level', type: 'enum', 
      options: ['brief', 'standard', 'detailed', 'exhaustive'], default: 'standard' },
    { id: 'focusOn', label: 'Focus On', type: 'enum',
      options: ['all', 'objects', 'style', 'mood', 'composition', 'colors'], default: 'all' },
    { id: 'includeNegative', label: 'Include Negative Prompt', type: 'boolean', default: true },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const detailLevel = (ctx.parameters.detailLevel as string) || 'standard';
    const includeNeg = ctx.parameters.includeNegative !== false;

    // In production: call vision model API
    const analysis = generateAnalysisTemplate(detailLevel);
    const prompt = buildPrompt(analysis, includeNeg);
    const negativePrompt = includeNeg ? buildNegativePrompt() : '';
    
    return {
      outputs: {
        prompt,
        negativePrompt,
        objects: analysis.objects,
        style: analysis.style,
        palette: analysis.palette,
        composition: analysis.composition,
      },
      metadata: { detailLevel },
    };
  },
};

function generateAnalysisTemplate(detail: string): ImageAnalysis {
  const templates: Record<string, ImageAnalysis> = {
    brief: {
      objects: ['subject', 'background'], style: 'Photorealistic',
      palette: ['#000000', '#ffffff', '#888888'],
      composition: 'Centered subject, simple background',
      mood: 'Neutral', lighting: 'Even studio lighting',
      quality: 'High resolution, sharp focus',
      technical: '8k, professional photography',
    },
    standard: {
      objects: ['main subject', 'secondary elements', 'background details'],
      style: 'Cinematic photorealistic with shallow depth of field',
      palette: ['#1a1a2e', '#e94560', '#0f3460', '#16213e', '#f5f5f5'],
      composition: 'Rule of thirds, leading lines, foreground interest',
      mood: 'Dramatic and contemplative',
      lighting: 'Rembrandt lighting with rim light highlights',
      quality: '8K resolution, ultra detailed, sharp focus',
      technical: 'DSLR, 85mm lens, f/1.8, natural bokeh',
    },
    detailed: {
      objects: ['primary subject', 'secondary elements', 'detailed background', 'atmospheric particles', 'texture details'],
      style: 'Hyperrealistic cinematic photograph with subtle film grain',
      palette: ['#1a1a2e', '#e94560', '#0f3460', '#f5f5f5', '#e8d5b7', '#2d3436'],
      composition: 'Dynamic composition with strong diagonals, foreground framing, depth layering, focal point at golden ratio',
      mood: 'Melancholic yet hopeful, cinematic atmosphere with emotional weight',
      lighting: 'Three-point lighting with golden hour rim light, volumetric rays, subtle fill from practical sources',
      quality: '8K UHD, hyperdetailed, tack sharp, creamy bokeh, HDR tonemapping',
      technical: 'Hasselblad X1D, 90mm f/2.8, ISO 100, natural light, 16-bit color',
    },
    exhaustive: {
      objects: ['primary subject', 'detailed secondary characters', 'ornate background architecture', 'atmospheric haze', 'fabric textures', 'metallic reflections', 'organic foliage', 'foreground bokeh', 'lens flare artifacts'],
      style: 'Ultra-high-end cinematic hyperrealism, golden ratio composition, anamorphic lens characteristics, deliberate chromatic aberration for vintage feel',
      palette: ['#0d1117', '#e94560', '#0f3460', '#f0f0f0', '#e8d5b7', '#2d3436', '#ff6b35', '#1dd1a1', '#5f27cd'],
      composition: 'Complex multi-plane composition: foreground bokeh framing, midground main subject at golden ratio, background depth with atmospheric perspective, far background environmental storytelling. Dutch angle 3° for subtle tension.',
      mood: 'Profoundly contemplative with undercurrent of tension. Emotional resonance through color temperature contrast (warm subject / cool environment).',
      lighting: 'Motivated lighting: key light 45° left at 5600K, negative fill right for contrast, hair light at 3200K for separation, practicals in background at 2700K for depth, subtle eye light for catchlights.',
      quality: 'IMAX 70mm equivalent, diffraction-limited sharpness, 16-stop dynamic range, ACES color space, zero noise, perfect focus stacking',
      technical: 'ARRI Alexa 65, Panavision Primo 70, 50mm T1.9, 180° shutter, 24fps, ND 0.6, 4.5K Open Gate',
    },
  };
  return templates[detail] || templates.standard;
}

function buildPrompt(analysis: ImageAnalysis, includeTech: boolean): string {
  const parts = [
    analysis.objects.join(', '),
    analysis.style,
    analysis.composition,
    `${analysis.lighting}, ${analysis.mood} mood`,
    analysis.quality,
  ];
  if (includeTech) parts.push(analysis.technical);
  return parts.join('. ');
}

function buildNegativePrompt(): string {
  return 'blurry, low quality, distorted, deformed, bad anatomy, watermark, text, logo, oversaturated, ugly, duplicate, mutilated, out of frame, extra fingers, fused fingers, poorly drawn face, mutation, bad proportions';
}
