// ============================================================
// ARS TECHNICAI — Template Engine
// Save, load, edit, and reuse prompt templates with variables.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.template.engine';

export interface PromptTemplate {
  id: string;
  name: string;
  category: 'character' | 'scene' | 'product' | 'portrait' | 'landscape' | 'abstract' | 'custom';
  template: string;
  variables: TemplateVariable[];
  description: string;
  usageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface TemplateVariable {
  id: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'color';
  defaultValue: string;
  options?: string[];
  min?: number;
  max?: number;
  placeholder: string;
}

// Built-in templates
export const BUILTIN_TEMPLATES: PromptTemplate[] = [
  {
    id: 'cinematic-portrait',
    name: 'Cinematic Portrait',
    category: 'portrait',
    template: 'Cinematic portrait of {subject}, {lighting} lighting, {camera} lens, {mood} mood, {background} background, 8K, ultra-detailed, professional photography',
    variables: [
      { id: 'subject', label: 'Subject', type: 'text', defaultValue: 'a mysterious figure', placeholder: 'Describe the subject' },
      { id: 'lighting', label: 'Lighting', type: 'select', defaultValue: 'Rembrandt', options: ['Rembrandt', 'Studio 3-point', 'Golden hour', 'Neon noir', 'Natural window'], placeholder: '' },
      { id: 'camera', label: 'Camera', type: 'select', defaultValue: '85mm f/1.4', options: ['85mm f/1.4', '50mm f/1.8', '35mm f/1.4', '135mm f/2', '24mm f/1.4'], placeholder: '' },
      { id: 'mood', label: 'Mood', type: 'select', defaultValue: 'contemplative', options: ['contemplative', 'intense', 'serene', 'mysterious', 'joyful', 'melancholic'], placeholder: '' },
      { id: 'background', label: 'Background', type: 'text', defaultValue: 'dark studio', placeholder: 'Describe the background' },
    ],
    description: 'Professional cinematic portrait with configurable lighting and composition.',
    usageCount: 0, createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: 'character-sheet',
    name: 'Character Reference Sheet',
    category: 'character',
    template: 'Full body character reference sheet of {name}, {gender} {age}, {build} build, {hair} hair, {eyes} eyes, wearing {outfit}, {pose} pose, {lighting} lighting, {camera}, character design sheet, multiple views, 8K, clean background',
    variables: [
      { id: 'name', label: 'Name', type: 'text', defaultValue: 'Character', placeholder: 'Character name' },
      { id: 'gender', label: 'Gender', type: 'select', defaultValue: 'female', options: ['male', 'female', 'androgynous'], placeholder: '' },
      { id: 'age', label: 'Age', type: 'text', defaultValue: 'young adult', placeholder: 'Age description' },
      { id: 'build', label: 'Build', type: 'select', defaultValue: 'athletic', options: ['slim', 'athletic', 'muscular', 'average', 'tall'], placeholder: '' },
      { id: 'hair', label: 'Hair', type: 'text', defaultValue: 'long dark', placeholder: 'Hair description' },
      { id: 'eyes', label: 'Eyes', type: 'text', defaultValue: 'piercing blue', placeholder: 'Eye description' },
      { id: 'outfit', label: 'Outfit', type: 'text', defaultValue: 'tactical gear', placeholder: 'Outfit description' },
      { id: 'pose', label: 'Pose', type: 'select', defaultValue: 'standing', options: ['standing', 'action', 'portrait', 'dynamic', 'relaxed'], placeholder: '' },
      { id: 'lighting', label: 'Lighting', type: 'select', defaultValue: '3-point studio', options: ['3-point studio', 'dramatic', 'natural', 'rim light'], placeholder: '' },
      { id: 'camera', label: 'Camera', type: 'text', defaultValue: 'full body shot, 85mm', placeholder: 'Camera specs' },
    ],
    description: 'Character design reference sheet for consistent AI generation.',
    usageCount: 0, createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: 'product-hero',
    name: 'Product Hero Shot',
    category: 'product',
    template: 'Professional product photography of {product}, {angle} angle, {lighting} lighting, {background} background, studio setup, macro detail, 8K, commercial photography, Hasselblad',
    variables: [
      { id: 'product', label: 'Product', type: 'text', defaultValue: 'luxury watch', placeholder: 'Product description' },
      { id: 'angle', label: 'Angle', type: 'select', defaultValue: 'hero front', options: ['hero front', '45 degree', 'top-down', 'detail macro', 'lifestyle'], placeholder: '' },
      { id: 'lighting', label: 'Lighting', type: 'select', defaultValue: 'softbox', options: ['softbox', 'dramatic spot', 'natural window', 'rim light', 'product tent'], placeholder: '' },
      { id: 'background', label: 'Background', type: 'select', defaultValue: 'clean white', options: ['clean white', 'dark gradient', 'textured surface', 'lifestyle context', 'black void'], placeholder: '' },
    ],
    description: 'Professional product photography with commercial lighting.',
    usageCount: 0, createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: 'landscape-epic',
    name: 'Epic Landscape',
    category: 'landscape',
    template: '{time} at {location}, {weather} weather, {season} season, {camera} lens, wide panoramic view, {style} style, 8K, ultra-detailed, National Geographic',
    variables: [
      { id: 'time', label: 'Time of Day', type: 'select', defaultValue: 'Golden hour', options: ['Golden hour', 'Blue hour', 'Sunrise', 'Sunset', 'Midday', 'Night'], placeholder: '' },
      { id: 'location', label: 'Location', type: 'text', defaultValue: 'mountain valley with lake', placeholder: 'Location description' },
      { id: 'weather', label: 'Weather', type: 'select', defaultValue: 'partly cloudy', options: ['clear sky', 'partly cloudy', 'foggy', 'stormy', 'snow'], placeholder: '' },
      { id: 'season', label: 'Season', type: 'select', defaultValue: 'autumn', options: ['spring', 'summer', 'autumn', 'winter'], placeholder: '' },
      { id: 'camera', label: 'Camera', type: 'select', defaultValue: '24mm wide', options: ['24mm wide', '16mm ultra-wide', '50mm standard', '70-200mm telephoto'], placeholder: '' },
      { id: 'style', label: 'Style', type: 'select', defaultValue: 'photorealistic', options: ['photorealistic', 'cinematic', 'painterly', 'minimalist'], placeholder: '' },
    ],
    description: 'Epic landscape photography with environmental storytelling.',
    usageCount: 0, createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: 'sci-fi-scene',
    name: 'Sci-Fi Environment',
    category: 'scene',
    template: '{era} sci-fi {locationType}, {architecture} architecture, {atmosphere} atmosphere, {lighting} lighting, {colorPalette} color palette, volumetric fog, ray tracing, 8K, concept art',
    variables: [
      { id: 'era', label: 'Era', type: 'select', defaultValue: 'Cyberpunk', options: ['Cyberpunk', 'Distant future', 'Near future', 'Post-apocalyptic', 'Retro-futuristic', 'Alien'], placeholder: '' },
      { id: 'locationType', label: 'Location', type: 'text', defaultValue: 'megacity skyline', placeholder: 'Location type' },
      { id: 'architecture', label: 'Architecture', type: 'select', defaultValue: 'brutalist mega-structures', options: ['brutalist mega-structures', 'organic bio-tech', 'sleek minimalist', 'industrial decay', 'crystalline'], placeholder: '' },
      { id: 'atmosphere', label: 'Atmosphere', type: 'text', defaultValue: 'neon-drenched rain', placeholder: 'Atmosphere description' },
      { id: 'lighting', label: 'Lighting', type: 'select', defaultValue: 'neon + volumetric', options: ['neon + volumetric', 'harsh industrial', 'ambient glow', 'bioluminescent', 'holographic'], placeholder: '' },
      { id: 'colorPalette', label: 'Colors', type: 'select', defaultValue: 'teal and magenta', options: ['teal and magenta', 'orange and blue', 'monochromatic blue', 'warm amber', 'desaturated earth'], placeholder: '' },
    ],
    description: 'Sci-fi environment concept art with atmospheric detail.',
    usageCount: 0, createdAt: Date.now(), updatedAt: Date.now(),
  },
];

export const moduleDef: ModuleDef = {
  id,
  name: 'Template Engine',
  category: 'generate',
  description: 'Save, load, edit, and reuse prompt templates with typed variables. Fill templates with values to generate precise prompts. Built-in templates for character sheets, portraits, products, landscapes, and sci-fi scenes.',
  inputs: [
    { id: 'templateId', label: 'Template ID', type: 'text', direction: 'input', optional: true },
    { id: 'variableValues', label: 'Variable Values', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'filledPrompt', label: 'Filled Prompt', type: 'text', direction: 'output' },
    { id: 'template', label: 'Template Definition', type: 'data', direction: 'output' },
    { id: 'allTemplates', label: 'All Templates', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'templateId', label: 'Template', type: 'enum', options: BUILTIN_TEMPLATES.map(t => t.id), default: 'cinematic-portrait' },
    { id: 'action', label: 'Action', type: 'enum', options: ['fill', 'list', 'save', 'delete'], default: 'fill' },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const action = (ctx.parameters.action as string) || 'fill';
    const templateId = (ctx.parameters.templateId as string) || (ctx.inputs.templateId as string) || 'cinematic-portrait';
    
    const template = BUILTIN_TEMPLATES.find(t => t.id === templateId) || BUILTIN_TEMPLATES[0];
    const varValues = (ctx.inputs.variableValues as Record<string, string>) || {};

    if (action === 'list') {
      return { outputs: { allTemplates: BUILTIN_TEMPLATES, filledPrompt: '' }, metadata: { count: BUILTIN_TEMPLATES.length } };
    }

    if (action === 'fill') {
      let filled = template.template;
      for (const v of template.variables) {
        const value = varValues[v.id] || v.defaultValue;
        filled = filled.replace(new RegExp(`\\{${v.id}\\}`, 'g'), value);
      }
      return {
        outputs: { filledPrompt: filled, template, allTemplates: BUILTIN_TEMPLATES },
        metadata: { templateId, variableCount: template.variables.length },
      };
    }

    return { outputs: { template, allTemplates: BUILTIN_TEMPLATES, filledPrompt: '' }, metadata: { templateId } };
  },
};
