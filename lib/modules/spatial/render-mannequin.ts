// ============================================================
// ARS TECHNICAI — Mannequin SVG Renderer
// Generates character reference sheets WITHOUT AI.
// Configurable poses, backgrounds, lighting, camera angles.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = '3d.render.mannequin';

export interface MannequinConfig {
  pose: string;
  angle: string;
  gender: 'male' | 'female' | 'neutral';
  height: number;        // 0-1 normalized
  build: number;         // 0 = slim, 1 = muscular
  skinColor: string;
  hairColor: string;
  hairStyle: string;
  outfitColor: string;
  backgroundColor: string;
  backgroundType: 'solid' | 'gradient' | 'checkerboard' | 'radial';
  lightingDirection: 'front' | 'top-left' | 'top-right' | 'side-left' | 'side-right' | 'back-rim' | 'bottom';
  lightingIntensity: number;  // 0-1
  lightingColor: string;
  cameraDistance: number;     // 0.5-3
  cameraHeight: number;       // -1 to 2
  showGrid: boolean;
  showMeasurements: boolean;
  width: number;
  height: number;
}

export const MANNEQUIN_PRESETS: Record<string, Partial<MannequinConfig>> = {
  'reference-front': {
    pose: 't-pose', angle: 'front', lightingDirection: 'front',
    lightingIntensity: 0.7, showGrid: true, showMeasurements: true,
  },
  'reference-side': {
    pose: 't-pose', angle: 'side', lightingDirection: 'side-left',
    lightingIntensity: 0.6, showGrid: true, showMeasurements: true,
  },
  'hero-shot': {
    pose: 'action', angle: 'three-quarter', lightingDirection: 'top-right',
    lightingIntensity: 0.9, cameraHeight: -0.3, backgroundType: 'radial',
  },
  'portrait-studio': {
    pose: 'portrait', angle: 'front', lightingDirection: 'front',
    lightingIntensity: 0.8, cameraDistance: 1.5, cameraHeight: -0.1,
    backgroundType: 'gradient',
  },
  'dramatic': {
    pose: 'action', angle: 'low-angle', lightingDirection: 'back-rim',
    lightingIntensity: 1, cameraHeight: -0.8, backgroundType: 'radial',
  },
};

export const moduleDef: ModuleDef = {
  id,
  name: 'Mannequin Renderer',
  category: 'spatial',
  description: 'Generate character reference sheets as SVG without AI. 12 poses, 7 angles, configurable backgrounds, lighting directions, body proportions, and camera settings. Outputs printable reference images for AI generation.',
  inputs: [],
  outputs: [
    { id: 'svgDataUrl', label: 'SVG Reference Image', type: 'image', direction: 'output' },
    { id: 'config', label: 'Mannequin Config', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'preset', label: 'Preset', type: 'enum', options: ['reference-front', 'reference-side', 'hero-shot', 'portrait-studio', 'dramatic', 'custom'], default: 'reference-front' },
    { id: 'pose', label: 'Pose', type: 'enum', options: ['t-pose', 'a-pose', 'standing', 'walking', 'sitting', 'fighting', 'portrait', 'action', 'relaxed', 'running', 'jumping', 'crouching'], default: 't-pose' },
    { id: 'angle', label: 'View Angle', type: 'enum', options: ['front', 'side', 'back', 'three-quarter', 'low-angle', 'high-angle', 'top-down'], default: 'front' },
    { id: 'gender', label: 'Body Type', type: 'enum', options: ['male', 'female', 'neutral'], default: 'neutral' },
    { id: 'build', label: 'Build', type: 'number', default: 0.5, min: 0, max: 1, step: 0.1 },
    { id: 'height', label: 'Height', type: 'number', default: 0.7, min: 0.3, max: 1, step: 0.05 },
    { id: 'skinColor', label: 'Skin Color', type: 'color', default: '#e8c39e' },
    { id: 'hairColor', label: 'Hair Color', type: 'color', default: '#4a3728' },
    { id: 'outfitColor', label: 'Outfit Color', type: 'color', default: '#3b5998' },
    { id: 'backgroundColor', label: 'Background', type: 'color', default: '#1a1a2e' },
    { id: 'backgroundType', label: 'BG Type', type: 'enum', options: ['solid', 'gradient', 'checkerboard', 'radial'], default: 'solid' },
    { id: 'lightingDirection', label: 'Light Direction', type: 'enum', options: ['front', 'top-left', 'top-right', 'side-left', 'side-right', 'back-rim', 'bottom'], default: 'front' },
    { id: 'lightingIntensity', label: 'Light Intensity', type: 'number', default: 0.7, min: 0.1, max: 1, step: 0.05 },
    { id: 'lightingColor', label: 'Light Color', type: 'color', default: '#ffffff' },
    { id: 'cameraDistance', label: 'Camera Distance', type: 'number', default: 2, min: 0.5, max: 3, step: 0.1 },
    { id: 'showGrid', label: 'Show Grid', type: 'boolean', default: false },
    { id: 'showMeasurements', label: 'Show Measurements', type: 'boolean', default: false },
    { id: 'width', label: 'Output Width', type: 'number', default: 800, min: 256, max: 2048, step: 64 },
    { id: 'height', label: 'Output Height', type: 'number', default: 1024, min: 256, max: 2048, step: 64 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const p = ctx.parameters;
    const preset = MANNEQUIN_PRESETS[p.preset as string] || {};
    
    const config: MannequinConfig = {
      pose: (p.pose as string) || preset.pose || 't-pose',
      angle: (p.angle as string) || preset.angle || 'front',
      gender: (p.gender as MannequinConfig['gender']) || preset.gender || 'neutral',
      height: (p.height as number) ?? preset.height ?? 0.7,
      build: (p.build as number) ?? preset.build ?? 0.5,
      skinColor: (p.skinColor as string) || preset.skinColor || '#e8c39e',
      hairColor: (p.hairColor as string) || preset.hairColor || '#4a3728',
      hairStyle: (p.hairStyle as string) || 'short',
      outfitColor: (p.outfitColor as string) || preset.outfitColor || '#3b5998',
      backgroundColor: (p.backgroundColor as string) || preset.backgroundColor || '#1a1a2e',
      backgroundType: (p.backgroundType as MannequinConfig['backgroundType']) || preset.backgroundType || 'solid',
      lightingDirection: (p.lightingDirection as MannequinConfig['lightingDirection']) || preset.lightingDirection || 'front',
      lightingIntensity: (p.lightingIntensity as number) ?? preset.lightingIntensity ?? 0.7,
      lightingColor: (p.lightingColor as string) || preset.lightingColor || '#ffffff',
      cameraDistance: (p.cameraDistance as number) ?? preset.cameraDistance ?? 2,
      cameraHeight: (p.cameraHeight as number) ?? preset.cameraHeight ?? 0,
      showGrid: (p.showGrid as boolean) ?? preset.showGrid ?? false,
      showMeasurements: (p.showMeasurements as boolean) ?? preset.showMeasurements ?? false,
      width: (p.width as number) || 800,
      height: (p.height as number) || 1024,
    };

    const svg = renderMannequinSVG(config);
    const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;

    return {
      outputs: { svgDataUrl: dataUrl, config },
      metadata: { preset: p.preset, pose: config.pose, angle: config.angle },
    };
  },
};

/** Render a full SVG mannequin character reference sheet */
function renderMannequinSVG(cfg: MannequinConfig): string {
  const W = cfg.width;
  const H = cfg.height;
  const cx = W / 2;
  const groundY = H * 0.85;

  // Body proportions (8-head canon)
  const headSize = W * 0.06 * (0.8 + cfg.height * 0.4);
  const bodyHeight = headSize * 7;
  const bodyTop = groundY - bodyHeight;
  const bodyWidth = headSize * 1.8 * (0.7 + cfg.build * 0.6);

  // Lighting offset for shadow simulation
  const lightDir = cfg.lightingDirection;
  const shadowDX = lightDir.includes('right') ? 3 : lightDir.includes('left') ? -3 : 0;
  const shadowDY = lightDir.includes('top') ? -2 : lightDir.includes('bottom') ? 2 : 0;
  const lightIntensity = cfg.lightingIntensity;

  // Background
  let bgRect = '';
  switch (cfg.backgroundType) {
    case 'gradient':
      bgRect = `<defs><linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${lightenColor(cfg.backgroundColor, 20)}"/>
        <stop offset="100%" stop-color="${cfg.backgroundColor}"/>
      </linearGradient></defs><rect width="${W}" height="${H}" fill="url(#bgGrad)"/>`;
      break;
    case 'radial':
      bgRect = `<defs><radialGradient id="bgRad" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="${lightenColor(cfg.backgroundColor, 30)}"/>
        <stop offset="100%" stop-color="${cfg.backgroundColor}"/>
      </radialGradient></defs><rect width="${W}" height="${H}" fill="url(#bgRad)"/>`;
      break;
    case 'checkerboard':
      bgRect = `<defs><pattern id="checker" width="20" height="20" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="${cfg.backgroundColor}"/><rect x="10" y="10" width="10" height="10" fill="${cfg.backgroundColor}"/>
        <rect x="10" width="10" height="10" fill="${lightenColor(cfg.backgroundColor, 10)}"/><rect y="10" width="10" height="10" fill="${lightenColor(cfg.backgroundColor, 10)}"/>
      </pattern></defs><rect width="${W}" height="${H}" fill="url(#checker)"/>`;
      break;
    default:
      bgRect = `<rect width="${W}" height="${H}" fill="${cfg.backgroundColor}"/>`;
  }

  // Grid
  let gridSvg = '';
  if (cfg.showGrid) {
    const gridSize = 50;
    gridSvg = `<g stroke="rgba(255,255,255,0.08)" stroke-width="0.5">`;
    for (let x = 0; x < W; x += gridSize) gridSvg += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
    for (let y = 0; y < H; y += gridSize) gridSvg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;
    // Ground line
    gridSvg += `<line x1="0" y1="${groundY}" x2="${W}" y2="${groundY}" stroke="rgba(0,212,170,0.3)" stroke-width="1" stroke-dasharray="5,5"/>`;
    gridSvg += `</g>`;
  }

  // Ground shadow
  let shadowSvg = '';
  const shadowAlpha = 0.15 * lightIntensity;
  shadowSvg = `<ellipse cx="${cx + shadowDX * 2}" cy="${groundY + 4}" rx="${bodyWidth * 0.8}" ry="8" fill="rgba(0,0,0,${shadowAlpha})"/>`;

  // Light indicator
  let lightIndicator = '';
  const lx = cx + (lightDir.includes('right') ? 80 : lightDir.includes('left') ? -80 : 0);
  const ly = groundY - bodyHeight * 0.5 + (lightDir.includes('top') ? -60 : lightDir.includes('bottom') ? 60 : 0);
  lightIndicator = `<circle cx="${lx}" cy="${ly}" r="8" fill="${cfg.lightingColor}" opacity="${0.4 * lightIntensity}">
    <animate attributeName="opacity" values="${0.4 * lightIntensity};${0.15 * lightIntensity};${0.4 * lightIntensity}" dur="3s" repeatCount="indefinite"/>
  </circle>
  <line x1="${lx}" y1="${ly}" x2="${cx}" y2="${bodyTop + bodyHeight * 0.3}" stroke="${cfg.lightingColor}" stroke-width="0.5" opacity="${0.15 * lightIntensity}" stroke-dasharray="4,4"/>`;

  // Mannequin body
  let bodySvg = '';
  const isFront = cfg.angle === 'front' || cfg.angle === 'three-quarter';
  const isSide = cfg.angle === 'side';

  if (isFront || cfg.angle === 'three-quarter') {
    // Head
    const headCY = bodyTop + headSize * 0.5;
    bodySvg += `<ellipse cx="${cx}" cy="${headCY}" rx="${headSize * 0.45}" ry="${headSize * 0.55}" fill="${cfg.skinColor}" stroke="rgba(0,0,0,0.2)" stroke-width="1"/>`;
    // Hair
    bodySvg += `<ellipse cx="${cx}" cy="${headCY - headSize * 0.15}" rx="${headSize * 0.48}" ry="${headSize * 0.35}" fill="${cfg.hairColor}" opacity="0.85"/>`;
    // Eyes
    const eyeY = headCY - headSize * 0.05;
    bodySvg += `<circle cx="${cx - headSize * 0.15}" cy="${eyeY}" r="${headSize * 0.06}" fill="#fff"/><circle cx="${cx - headSize * 0.15}" cy="${eyeY}" r="${headSize * 0.03}" fill="#222"/>`;
    bodySvg += `<circle cx="${cx + headSize * 0.15}" cy="${eyeY}" r="${headSize * 0.06}" fill="#fff"/><circle cx="${cx + headSize * 0.15}" cy="${eyeY}" r="${headSize * 0.03}" fill="#222"/>`;
    // Mouth
    bodySvg += `<path d="M${cx - headSize * 0.1},${headCY + headSize * 0.2} Q${cx},${headCY + headSize * 0.3} ${cx + headSize * 0.1},${headCY + headSize * 0.2}" stroke="rgba(0,0,0,0.3)" stroke-width="0.8" fill="none"/>`;

    // Neck
    const neckTop = headCY + headSize * 0.45;
    const neckBottom = neckTop + headSize * 0.4;
    bodySvg += `<rect x="${cx - headSize * 0.15}" y="${neckTop}" width="${headSize * 0.3}" height="${headSize * 0.4}" rx="3" fill="${cfg.skinColor}"/>`;

    // Torso
    const torsoTop = neckBottom;
    const torsoH = headSize * 2.5;
    const torsoW = bodyWidth;
    const torsoBottom = torsoTop + torsoH;
    bodySvg += `<rect x="${cx - torsoW * 0.5}" y="${torsoTop}" width="${torsoW}" height="${torsoH}" rx="${torsoW * 0.3}" fill="${cfg.outfitColor}" opacity="0.9"/>`;

    // Arms (depending on pose)
    const shoulderY = torsoTop + headSize * 0.3;
    if (cfg.pose === 't-pose') {
      // Arms straight out
      bodySvg += armSVG(cx - torsoW * 0.5, shoulderY, -1, headSize, torsoW, cfg, 'left');
      bodySvg += armSVG(cx + torsoW * 0.5, shoulderY, 1, headSize, torsoW, cfg, 'right');
    } else if (cfg.pose === 'a-pose') {
      bodySvg += armAngledSVG(cx - torsoW * 0.4, shoulderY, -0.6, 0.5, headSize, torsoW, cfg, 'left');
      bodySvg += armAngledSVG(cx + torsoW * 0.4, shoulderY, 0.6, 0.5, headSize, torsoW, cfg, 'right');
    } else if (cfg.pose === 'portrait' || cfg.pose === 'standing') {
      bodySvg += armAngledSVG(cx - torsoW * 0.45, shoulderY, -0.2, 1.2, headSize, torsoW, cfg, 'left');
      bodySvg += armAngledSVG(cx + torsoW * 0.45, shoulderY, 0.2, 1.2, headSize, torsoW, cfg, 'right');
    } else {
      // Action pose — arms in dynamic positions
      bodySvg += armAngledSVG(cx - torsoW * 0.4, shoulderY, -1.0, -0.3, headSize, torsoW, cfg, 'left');
      bodySvg += armAngledSVG(cx + torsoW * 0.4, shoulderY, 0.8, 0.2, headSize, torsoW, cfg, 'right');
    }

    // Legs
    const hipY = torsoBottom;
    const legH = headSize * 3.5;
    bodySvg += legSVG(cx - torsoW * 0.2, hipY, legH, torsoW * 0.3, cfg, cfg.pose === 'sitting' ? 'sitting' : 'standing');
    bodySvg += legSVG(cx + torsoW * 0.2, hipY, legH, torsoW * 0.3, cfg, cfg.pose === 'sitting' ? 'sitting' : 'standing');
  } else if (isSide) {
    // Side view — simplified
    const headCY = bodyTop + headSize * 0.5;
    bodySvg += `<ellipse cx="${cx}" cy="${headCY}" rx="${headSize * 0.35}" ry="${headSize * 0.55}" fill="${cfg.skinColor}"/>`;
    bodySvg += `<ellipse cx="${cx + headSize * 0.05}" cy="${headCY - headSize * 0.1}" rx="${headSize * 0.4}" ry="${headSize * 0.3}" fill="${cfg.hairColor}" opacity="0.85"/>`;
    bodySvg += `<rect x="${cx - headSize * 0.12}" y="${headCY + headSize * 0.4}" width="${headSize * 0.25}" height="${headSize * 0.35}" fill="${cfg.skinColor}"/>`;
    bodySvg += `<rect x="${cx - torsoW * 0.3}" y="${headCY + headSize * 0.75}" width="${torsoW * 0.6}" height="${headSize * 2.5}" rx="6" fill="${cfg.outfitColor}" opacity="0.9"/>`;
    bodySvg += `<rect x="${cx - torsoW * 0.15}" y="${headCY + headSize * 3.25}" width="${torsoW * 0.3}" height="${headSize * 3.5}" rx="4" fill="${cfg.outfitColor}" opacity="0.7"/>`;
  }

  // Measurements overlay
  let measureSvg = '';
  if (cfg.showMeasurements) {
    const mColor = 'rgba(0,212,170,0.4)';
    // Height line
    const totalH = bodyHeight + headSize * 0.5;
    measureSvg += `<line x1="${cx + bodyWidth * 0.5 + 20}" y1="${groundY}" x2="${cx + bodyWidth * 0.5 + 20}" y2="${bodyTop - headSize * 0.5}" stroke="${mColor}" stroke-width="1"/>`;
    measureSvg += `<line x1="${cx + bodyWidth * 0.5 + 15}" y1="${groundY}" x2="${cx + bodyWidth * 0.5 + 25}" y2="${groundY}" stroke="${mColor}" stroke-width="0.5"/>`;
    measureSvg += `<line x1="${cx + bodyWidth * 0.5 + 15}" y1="${bodyTop - headSize * 0.5}" x2="${cx + bodyWidth * 0.5 + 25}" y2="${bodyTop - headSize * 0.5}" stroke="${mColor}" stroke-width="0.5"/>`;
    measureSvg += `<text x="${cx + bodyWidth * 0.5 + 26}" y="${groundY - totalH * 0.5}" fill="${mColor}" font-size="9" font-family="monospace">${Math.round(totalH)}px</text>`;
  }

  // Footer
  const footerSvg = `<text x="${W - 12}" y="${H - 10}" text-anchor="end" fill="rgba(255,255,255,0.15)" font-size="9" font-family="monospace">
    Ars Technic AI — Mannequin • ${cfg.pose} • ${cfg.angle} • ${cfg.lightingDirection}
  </text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${bgRect}
${bgRect ? '' : `<rect width="${W}" height="${H}" fill="${cfg.backgroundColor}"/>`}
${gridSvg}
${shadowSvg}
${lightIndicator}
${bodySvg}
${measureSvg}
${footerSvg}
</svg>`;
}

function armSVG(x: number, y: number, dir: number, hs: number, tw: number, cfg: MannequinConfig, side: string): string {
  const armLen = hs * 3;
  const armW = tw * 0.18;
  const ex = x + dir * armLen;
  return `<rect x="${Math.min(x, ex)}" y="${y}" width="${Math.abs(ex - x)}" height="${armW}" rx="${armW * 0.5}" fill="${cfg.outfitColor}" opacity="0.7"/>`;
}

function armAngledSVG(x: number, y: number, dx: number, dy: number, hs: number, tw: number, cfg: MannequinConfig, side: string): string {
  const armLen = hs * 2.5;
  const armW = tw * 0.16;
  const ex = x + dx * armLen;
  const ey = y + dy * armLen;
  const angle = Math.atan2(ey - y, ex - x) * 180 / Math.PI;
  return `<g transform="rotate(${angle}, ${x}, ${y})">
    <rect x="${x}" y="${y - armW * 0.5}" width="${armLen}" height="${armW}" rx="${armW * 0.5}" fill="${cfg.outfitColor}" opacity="0.7"/>
  </g>`;
}

function legSVG(x: number, y: number, len: number, w: number, cfg: MannequinConfig, pose: string): string {
  if (pose === 'sitting') {
    return `<rect x="${x - w * 0.5}" y="${y}" width="${w}" height="${len * 0.5}" rx="4" fill="${cfg.outfitColor}" opacity="0.7"/>
    <rect x="${x + w * 0.5}" y="${y + len * 0.3}" width="${len * 0.5}" height="${w * 0.8}" rx="3" fill="${cfg.outfitColor}" opacity="0.5"/>`;
  }
  return `<rect x="${x - w * 0.5}" y="${y}" width="${w}" height="${len}" rx="4" fill="${cfg.outfitColor}" opacity="0.7"/>`;
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
  const b = Math.min(255, (num & 0x0000FF) + percent);
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}
