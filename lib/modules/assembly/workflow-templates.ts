// ============================================================
// ARS TECHNICAI — Workflow Template Library (COMFY-016)
// 6 built-in workflow templates for common tasks.
// One-click load into NodeGraph. User can save custom.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';
import type { ExecutionGraph } from '../graph-executor';

export const id = 'asm.workflow.templates';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  thumbnail?: string;
  graph: ExecutionGraph;
  estimatedDuration: number;
  requiredModules: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export const BUILTIN_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'txt2img',
    name: 'Text to Image',
    description: 'Basic text-to-image generation. Prompt → CLIP Encode → KSampler → VAE Decode → Save.',
    category: 'generation',
    tags: ['basic', 'txt2img', 'image'],
    difficulty: 'beginner',
    estimatedDuration: 10,
    requiredModules: ['gen.clip.encode', 'gen.image', 'gen.vae.decode', 'pub.save.preview'],
    graph: {
      nodes: [
        { id: 'prompt-node', moduleId: 'gen.clip.encode', title: 'Prompt Encode', x: 100, y: 200, params: { prompt: 'your prompt here' }, status: 'idle' },
        { id: 'sampler-node', moduleId: 'gen.image', title: 'KSampler', x: 400, y: 200, params: { steps: 30, cfg: 7, sampler: 'euler' }, status: 'idle' },
        { id: 'vae-node', moduleId: 'gen.vae.decode', title: 'VAE Decode', x: 700, y: 200, params: { latentFormat: 'SD1.5' }, status: 'idle' },
        { id: 'save-node', moduleId: 'pub.save.preview', title: 'Save', x: 1000, y: 200, params: { format: 'png' }, status: 'idle' },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'prompt-node', fromPort: 'conditioning', toNodeId: 'sampler-node', toPort: 'conditioning' },
        { id: 'e2', fromNodeId: 'sampler-node', fromPort: 'latent', toNodeId: 'vae-node', toPort: 'latent' },
        { id: 'e3', fromNodeId: 'vae-node', fromPort: 'image', toNodeId: 'save-node', toPort: 'image' },
      ],
    },
  },
  {
    id: 'img2img',
    name: 'Image to Image',
    description: 'Transform existing image. Load Image → VAE Encode → KSampler (partial denoise) → VAE Decode → Save.',
    category: 'generation',
    tags: ['img2img', 'refine', 'style-transfer'],
    difficulty: 'intermediate',
    estimatedDuration: 15,
    requiredModules: ['import.import.file', 'gen.img2img', 'gen.vae.decode', 'pub.save.preview'],
    graph: {
      nodes: [
        { id: 'load-node', moduleId: 'import.import.file', title: 'Load Image', x: 100, y: 200, params: {}, status: 'idle' },
        { id: 'img2img-node', moduleId: 'gen.img2img', title: 'Img2Img', x: 400, y: 200, params: { denoise: 0.6, steps: 30 }, status: 'idle' },
        { id: 'save-node', moduleId: 'pub.save.preview', title: 'Save', x: 700, y: 200, params: { format: 'png' }, status: 'idle' },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'load-node', fromPort: 'image', toNodeId: 'img2img-node', toPort: 'image' },
        { id: 'e2', fromNodeId: 'img2img-node', fromPort: 'image', toNodeId: 'save-node', toPort: 'image' },
      ],
    },
  },
  {
    id: 'inpaint',
    name: 'Inpainting',
    description: 'Fill masked regions. Load Image + Mask → Inpaint → Save.',
    category: 'generation',
    tags: ['inpaint', 'mask', 'fill'],
    difficulty: 'intermediate',
    estimatedDuration: 15,
    requiredModules: ['import.import.file', 'edit.mask.editor', 'gen.inpaint', 'pub.save.preview'],
    graph: {
      nodes: [
        { id: 'load-img', moduleId: 'import.import.file', title: 'Load Image', x: 100, y: 150, params: {}, status: 'idle' },
        { id: 'mask-node', moduleId: 'edit.mask.editor', title: 'Mask Editor', x: 100, y: 350, params: { tool: 'brush' }, status: 'idle' },
        { id: 'inpaint-node', moduleId: 'gen.inpaint', title: 'Inpaint', x: 450, y: 250, params: { strength: 0.75 }, status: 'idle' },
        { id: 'save-node', moduleId: 'pub.save.preview', title: 'Save', x: 750, y: 250, params: { format: 'png' }, status: 'idle' },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'load-img', fromPort: 'image', toNodeId: 'inpaint-node', toPort: 'image' },
        { id: 'e2', fromNodeId: 'mask-node', fromPort: 'mask', toNodeId: 'inpaint-node', toPort: 'mask' },
        { id: 'e3', fromNodeId: 'inpaint-node', fromPort: 'result', toNodeId: 'save-node', toPort: 'image' },
      ],
    },
  },
  {
    id: 'upscale',
    name: 'Upscale Image',
    description: 'Increase resolution. Load Image → Upscale Tiled → Save.',
    category: 'enhancement',
    tags: ['upscale', 'resolution', 'enhance'],
    difficulty: 'beginner',
    estimatedDuration: 8,
    requiredModules: ['import.import.file', 'edit.upscale.tiled', 'pub.save.preview'],
    graph: {
      nodes: [
        { id: 'load-node', moduleId: 'import.import.file', title: 'Load Image', x: 100, y: 200, params: {}, status: 'idle' },
        { id: 'upscale-node', moduleId: 'edit.upscale.tiled', title: 'Upscale 4x', x: 450, y: 200, params: { scale: '4x', model: 'RealESRGAN' }, status: 'idle' },
        { id: 'save-node', moduleId: 'pub.save.preview', title: 'Save', x: 800, y: 200, params: { format: 'png' }, status: 'idle' },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'load-node', fromPort: 'image', toNodeId: 'upscale-node', toPort: 'image' },
        { id: 'e2', fromNodeId: 'upscale-node', fromPort: 'upscaledImage', toNodeId: 'save-node', toPort: 'image' },
      ],
    },
  },
  {
    id: 'character-sheet',
    name: 'Character Sheet',
    description: 'Generate consistent character. Prompt → CLIP Encode → KSampler (×4 views) → Save.',
    category: 'character',
    tags: ['character', 'reference', 'consistency'],
    difficulty: 'advanced',
    estimatedDuration: 25,
    requiredModules: ['gen.character.sheet', 'gen.clip.encode', 'gen.image', 'gen.vae.decode', 'pub.save.preview'],
    graph: {
      nodes: [
        { id: 'char-node', moduleId: 'gen.character.sheet', title: 'Character Creator', x: 100, y: 200, params: { poses: 'front-standing,side-standing,back-standing,front-portrait' }, status: 'idle' },
        { id: 'encode-node', moduleId: 'gen.clip.encode', title: 'Encode', x: 400, y: 200, params: {}, status: 'idle' },
        { id: 'sampler-node', moduleId: 'gen.image', title: 'Generate', x: 700, y: 200, params: { steps: 30, cfg: 7 }, status: 'idle' },
        { id: 'save-node', moduleId: 'pub.save.preview', title: 'Save Sheet', x: 1000, y: 200, params: { format: 'png' }, status: 'idle' },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'char-node', fromPort: 'posePrompts', toNodeId: 'encode-node', toPort: 'prompt' },
        { id: 'e2', fromNodeId: 'encode-node', fromPort: 'conditioning', toNodeId: 'sampler-node', toPort: 'conditioning' },
        { id: 'e3', fromNodeId: 'sampler-node', fromPort: 'image', toNodeId: 'save-node', toPort: 'image' },
      ],
    },
  },
  {
    id: 'video-frames',
    name: 'Batch Video Frames',
    description: 'Generate N images from prompt list. Batch Prompts → Generate ×N → Save All.',
    category: 'video',
    tags: ['batch', 'video', 'frames'],
    difficulty: 'advanced',
    estimatedDuration: 30,
    requiredModules: ['gen.batch.prompts', 'gen.image', 'gen.vae.decode', 'pub.save.preview'],
    graph: {
      nodes: [
        { id: 'batch-node', moduleId: 'gen.batch.prompts', title: 'Batch Prompts', x: 100, y: 200, params: { maxConcurrent: 2 }, status: 'idle' },
        { id: 'gen-node', moduleId: 'gen.image', title: 'Generate', x: 450, y: 200, params: { steps: 30, cfg: 7 }, status: 'idle' },
        { id: 'save-node', moduleId: 'pub.save.preview', title: 'Save All', x: 800, y: 200, params: { format: 'png' }, status: 'idle' },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'batch-node', fromPort: 'jobs', toNodeId: 'gen-node', toPort: 'prompt' },
        { id: 'e2', fromNodeId: 'gen-node', fromPort: 'image', toNodeId: 'save-node', toPort: 'image' },
      ],
    },
  },
];

export const moduleDef: ModuleDef = {
  id,
  name: 'Workflow Templates',
  category: 'assembly',
  description: 'Built-in workflow templates for common tasks: txt2img, img2img, inpainting, upscale, character sheet, batch video frames. One-click load into NodeGraph. Save custom workflows as new templates.',
  inputs: [],
  outputs: [
    { id: 'templates', label: 'Template List', type: 'data', direction: 'output' },
    { id: 'selectedGraph', label: 'Selected Graph', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'templateId', label: 'Template', type: 'enum', options: BUILTIN_TEMPLATES.map(t => t.id), default: 'txt2img' },
    { id: 'action', label: 'Action', type: 'enum', options: ['list', 'load', 'save-custom'], default: 'load' },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const action = (ctx.parameters.action as string) || 'load';

    if (action === 'list') {
      return {
        outputs: { templates: BUILTIN_TEMPLATES, selectedGraph: null },
        metadata: { count: BUILTIN_TEMPLATES.length, categories: [...new Set(BUILTIN_TEMPLATES.map(t => t.category))] },
      };
    }

    const templateId = (ctx.parameters.templateId as string) || 'txt2img';
    const template = BUILTIN_TEMPLATES.find(t => t.id === templateId) || BUILTIN_TEMPLATES[0];

    return {
      outputs: { templates: BUILTIN_TEMPLATES, selectedGraph: template.graph },
      metadata: {
        templateId,
        templateName: template.name,
        difficulty: template.difficulty,
        nodeCount: template.graph.nodes.length,
        edgeCount: template.graph.edges.length,
        estimatedDuration: template.estimatedDuration,
      },
    };
  },
};
