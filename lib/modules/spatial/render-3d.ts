// ============================================================
// ARS TECHNICAI — 3D Render Module
// Renders a Three.js scene from a scene definition and captures
// the viewport as an image. Supports mannequins, lighting rigs,
// camera paths, and material overrides.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = '3d.render.3d';

export interface ThreeSceneDef {
  objects: ThreeObjectDef[];
  lights: ThreeLightDef[];
  camera: ThreeCameraDef;
  background?: string;  // CSS color or gradient
  environmentMap?: string;  // HDRI URL
}

export interface ThreeObjectDef {
  type: 'mannequin' | 'cube' | 'sphere' | 'plane' | 'cylinder' | 'torus' | 'imported';
  id: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  material?: {
    color?: string;
    roughness?: number;
    metalness?: number;
    opacity?: number;
    emissive?: string;
    emissiveIntensity?: number;
    wireframe?: boolean;
  };
  // Mannequin-specific
  pose?: 't-pose' | 'a-pose' | 'walking' | 'sitting' | 'standing' | 'fighting' | 'relaxed';
  outfit?: string;
  // For imported models
  modelUrl?: string;
  modelFormat?: 'gltf' | 'glb' | 'obj' | 'fbx';
}

export interface ThreeLightDef {
  type: 'ambient' | 'directional' | 'point' | 'spot' | 'hemisphere';
  color?: string;
  intensity?: number;
  position?: [number, number, number];
  target?: [number, number, number];
  angle?: number;
  penumbra?: number;
  distance?: number;
  decay?: number;
  castShadow?: boolean;
}

export interface ThreeCameraDef {
  type: 'perspective' | 'orthographic';
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;           // perspective only
  near?: number;
  far?: number;
  width?: number;         // output width
  height?: number;        // output height
}

export interface ThreeRenderResult {
  imageDataUrl: string;
  width: number;
  height: number;
  renderTimeMs: number;
  sceneDef: ThreeSceneDef;
}

// Scene presets for quick setup
export const SCENE_PRESETS: Record<string, ThreeSceneDef> = {
  'studio-portrait': {
    objects: [
      {
        type: 'mannequin', id: 'subject',
        position: [0, -0.5, 0],
        pose: 'standing',
        material: { roughness: 0.5, metalness: 0.1 },
      },
      {
        type: 'plane', id: 'floor',
        position: [0, -1.8, 0],
        scale: [10, 1, 10],
        material: { color: '#2a2a35', roughness: 0.8 },
      },
      {
        type: 'plane', id: 'backdrop',
        position: [0, 1, -4],
        rotation: [0, 0, 0],
        scale: [8, 1, 1],
        material: { color: '#1a1a25', roughness: 0.6 },
      },
    ],
    lights: [
      { type: 'ambient', color: '#ffffff', intensity: 0.4 },
      { type: 'directional', color: '#ffffff', intensity: 1.2, position: [5, 8, 5], castShadow: true },
      { type: 'point', color: '#4488ff', intensity: 0.6, position: [-3, 2, 3] },
      { type: 'point', color: '#ff6644', intensity: 0.4, position: [3, 1, -2] },
    ],
    camera: {
      type: 'perspective', fov: 45, near: 0.1, far: 100,
      position: [0, 0.3, 3.5], target: [0, 0, 0],
      width: 1024, height: 1024,
    },
    background: '#0a0a0d',
  },
  'product-shot': {
    objects: [
      {
        type: 'sphere', id: 'product',
        position: [0, 0, 0],
        material: { color: '#00d4aa', roughness: 0.2, metalness: 0.8 },
      },
      {
        type: 'plane', id: 'floor',
        position: [0, -1.5, 0],
        scale: [6, 1, 6],
        material: { color: '#1a1a25', roughness: 0.4, metalness: 0.5 },
      },
    ],
    lights: [
      { type: 'ambient', intensity: 0.3 },
      { type: 'directional', intensity: 1.0, position: [3, 5, 4], castShadow: true },
      { type: 'point', color: '#ffaa44', intensity: 0.8, position: [2, 2, 3] },
      { type: 'point', color: '#44aaff', intensity: 0.5, position: [-2, 1, -1] },
    ],
    camera: {
      type: 'perspective', fov: 50, near: 0.1, far: 100,
      position: [1.5, 0.5, 2.5], target: [0, 0, 0],
      width: 1024, height: 1024,
    },
    background: '#0a0a10',
  },
  'character-sheet': {
    objects: [
      { type: 'mannequin', id: 'front', position: [-2, -0.5, 0], pose: 'standing' },
      { type: 'mannequin', id: 'side', position: [0, -0.5, 0], pose: 'standing', rotation: [0, Math.PI / 2, 0] },
      { type: 'mannequin', id: 'back', position: [2, -0.5, 0], pose: 'standing', rotation: [0, Math.PI, 0] },
      { type: 'plane', id: 'floor', position: [0, -1.8, 0], scale: [10, 1, 5], material: { color: '#222', roughness: 1 } },
    ],
    lights: [
      { type: 'ambient', intensity: 0.5 },
      { type: 'directional', intensity: 1.0, position: [0, 6, 3], castShadow: true },
    ],
    camera: {
      type: 'perspective', fov: 55, near: 0.1, far: 100,
      position: [0, 0.2, 6], target: [0, -0.3, 0],
      width: 1920, height: 1080,
    },
    background: '#111118',
  },
};

export const moduleDef: ModuleDef = {
  id,
  name: '3D Render',
  category: 'spatial',
  description: 'Render a Three.js 3D scene with mannequins, objects, lighting, and camera rigs. Supports scene presets for portraits, product shots, and character sheets. Outputs a rendered image data URL.',
  inputs: [
    { id: 'scene', label: 'Scene Definition', type: 'data', direction: 'input', optional: true },
    { id: 'preset', label: 'Scene Preset', type: 'text', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'image', label: 'Rendered Image', type: 'image', direction: 'output' },
    { id: 'sceneData', label: 'Scene Data', type: 'data', direction: 'output' },
    { id: 'depthMap', label: 'Depth Map', type: 'image', direction: 'output', optional: true },
  ],
  parameters: [
    { id: 'preset', label: 'Scene Preset', type: 'enum', 
      options: ['studio-portrait', 'product-shot', 'character-sheet', 'custom'],
      default: 'studio-portrait' },
    { id: 'width', label: 'Output Width', type: 'number', default: 1024, min: 256, max: 4096, step: 64 },
    { id: 'height', label: 'Output Height', type: 'number', default: 1024, min: 256, max: 4096, step: 64 },
    { id: 'antiAlias', label: 'Anti-Alias', type: 'boolean', default: true },
    { id: 'shadows', label: 'Cast Shadows', type: 'boolean', default: true },
    { id: 'background', label: 'Background Color', type: 'color', default: '#0a0a0d' },
    { id: 'mannequinPose', label: 'Mannequin Pose', type: 'enum',
      options: ['t-pose', 'a-pose', 'walking', 'sitting', 'standing', 'fighting', 'relaxed'],
      default: 'standing' },
    { id: 'cameraDistance', label: 'Camera Distance', type: 'number', default: 3.5, min: 0.5, max: 20, step: 0.1 },
    { id: 'cameraHeight', label: 'Camera Height', type: 'number', default: 0.3, min: -5, max: 5, step: 0.1 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const params = ctx.parameters;
    const presetName = (params.preset as string) || 'studio-portrait';
    const width = (params.width as number) || 1024;
    const height = (params.height as number) || 1024;
    const bgColor = (params.background as string) || '#0a0a0d';
    const mannequinPose = (params.mannequinPose as string) || 'standing';
    const camDist = (params.cameraDistance as number) || 3.5;
    const camHeight = (params.cameraHeight as number) || 0.3;

    // Use preset or input scene definition
    let sceneDef: ThreeSceneDef;
    if (ctx.inputs.scene) {
      sceneDef = ctx.inputs.scene as ThreeSceneDef;
    } else if (SCENE_PRESETS[presetName]) {
      sceneDef = JSON.parse(JSON.stringify(SCENE_PRESETS[presetName]));
      // Apply parameter overrides
      const mannequins = sceneDef.objects.filter(o => o.type === 'mannequin');
      mannequins.forEach(m => { m.pose = mannequinPose as ThreeObjectDef['pose']; });
      sceneDef.camera.position = [0, camHeight, camDist];
      sceneDef.camera.width = width;
      sceneDef.camera.height = height;
      sceneDef.background = bgColor;
    } else {
      sceneDef = SCENE_PRESETS['studio-portrait'];
      sceneDef.camera.width = width;
      sceneDef.camera.height = height;
    }

    const t0 = performance.now();

    // Render via server-side canvas (Node.js canvas-free render)
    // For now, generate a placeholder SVG representing the 3D scene
    // This is a stub renderer — real Three.js rendering needs browser context
    // or a headless WebGL renderer (puppeteer, headless-gl, etc.)
    const svgScene = generateSceneSVG(sceneDef);
    const dataUrl = `data:image/svg+xml;base64,${btoa(svgScene)}`;

    const renderTimeMs = Math.round(performance.now() - t0);

    ctx.onProgress?.(100, 'Render complete');

    return {
      outputs: {
        image: dataUrl,
        sceneData: sceneDef,
        depthMap: null,  // available in browser mode
      },
      metadata: {
        renderTimeMs,
        preset: presetName,
        width,
        height,
        objectCount: sceneDef.objects.length,
        lightCount: sceneDef.lights.length,
      },
    };
  },
};

/** Generate a representative SVG of the 3D scene for offline/preview rendering */
function generateSceneSVG(scene: ThreeSceneDef): string {
  const w = scene.camera.width || 1024;
  const h = scene.camera.height || 1024;
  const bg = scene.background || '#0a0a0d';

  let objects = '';
  for (const obj of scene.objects) {
    const cx = w / 2 + (obj.position[0] || 0) * (w / 8);
    const cy = h / 2 - (obj.position[1] || 0) * (h / 8);
    const s = (obj.scale?.[0] || 1) * 40;
    const color = obj.material?.color || '#888';
    const opacity = obj.material?.opacity ?? 1;

    switch (obj.type) {
      case 'mannequin':
        objects += `<g opacity="${opacity}">
          <ellipse cx="${cx}" cy="${cy - s * 0.3}" rx="${s * 0.25}" ry="${s * 0.25}" fill="${color}" opacity="0.6"/>
          <rect x="${cx - s * 0.15}" y="${cy - s * 0.05}" width="${s * 0.3}" height="${s * 0.4}" rx="${s * 0.1}" fill="${color}"/>
          <rect x="${cx - s * 0.2}" y="${cy + s * 0.35}" width="${s * 0.4}" height="${s * 0.3}" rx="${s * 0.08}" fill="${color}"/>
          <rect x="${cx - s * 0.3}" y="${cy + s * 0.65}" width="${s * 0.15}" height="${s * 0.35}" rx="${s * 0.06}" fill="${color}" opacity="0.8"/>
          <rect x="${cx + s * 0.15}" y="${cy + s * 0.65}" width="${s * 0.15}" height="${s * 0.35}" rx="${s * 0.06}" fill="${color}" opacity="0.8"/>
          <text x="${cx}" y="${cy - s * 0.7}" text-anchor="middle" fill="white" font-size="12" opacity="0.5">${obj.pose || 'standing'}</text>
        </g>`;
        break;
      case 'sphere':
        objects += `<circle cx="${cx}" cy="${cy}" r="${s * 0.5}" fill="${color}" opacity="${opacity}"/>`;
        break;
      case 'cube':
        objects += `<rect x="${cx - s * 0.4}" y="${cy - s * 0.4}" width="${s * 0.8}" height="${s * 0.8}" fill="${color}" opacity="${opacity}"/>`;
        break;
      case 'cylinder':
        objects += `<rect x="${cx - s * 0.25}" y="${cy - s * 0.4}" width="${s * 0.5}" height="${s * 0.8}" rx="${s * 0.2}" fill="${color}" opacity="${opacity}"/>`;
        break;
      case 'torus':
        objects += `<circle cx="${cx}" cy="${cy}" r="${s * 0.4}" fill="none" stroke="${color}" stroke-width="${s * 0.12}" opacity="${opacity}"/>`;
        break;
      case 'plane':
        objects += `<rect x="${cx - (obj.scale?.[0]||1) * 60}" y="${cy}" width="${(obj.scale?.[0]||1) * 120}" height="${(obj.scale?.[2]||1) * 4}" fill="${color}" opacity="${opacity * 0.5}" rx="2"/>`;
        break;
    }
  }

  // Ground shadow
  objects += `<ellipse cx="${w/2}" cy="${h * 0.65}" rx="${w * 0.2}" ry="${h * 0.04}" fill="black" opacity="0.3"/>`;

  // Lighting indicators
  for (const light of scene.lights) {
    if (light.type === 'ambient') continue;
    const lx = w / 2 + (light.position?.[0] || 0) * (w / 8);
    const ly = h / 2 - (light.position?.[1] || 0) * (h / 8);
    const lColor = light.color || '#ffff00';
    objects += `<circle cx="${lx}" cy="${ly}" r="6" fill="${lColor}" opacity="0.8">
      <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite"/>
    </circle>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="${lightenColor(bg, 15)}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${bg}" stop-opacity="1"/>
    </radialGradient>
    <radialGradient id="spotGrad" cx="50%" cy="30%" r="50%">
      <stop offset="0%" stop-color="white" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bgGrad)"/>
  <ellipse cx="${w/2}" cy="${h * 0.3}" rx="${w * 0.5}" ry="${h * 0.5}" fill="url(#spotGrad)"/>
  ${objects}
  <text x="${w - 16}" y="${h - 12}" text-anchor="end" fill="white" font-size="10" opacity="0.25" font-family="monospace">3D Preview — Ars Technic AI</text>
</svg>`;
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
  const b = Math.min(255, (num & 0x0000FF) + percent);
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}
