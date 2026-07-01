// ============================================================
// ARS TECHNICAI — Composition Overlay Generator
// Generates SVG composition guides: rule of thirds grid,
// golden ratio spiral, character position markers, 
// perspective lines, and framing guides.
// These are overlaid on the prompt preview to help users
// visualize composition before AI generation.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.composition.overlay';

export interface CompositionOverlay {
  type: string;
  svgDataUrl: string;
  width: number;
  height: number;
}

export interface CompositionConfig {
  guides: string[];        // which guides to show
  characterMarkers: Array<{x: number; y: number; label: string}>;
  perspectiveLines: Array<{x1: number; y1: number; x2: number; y2: number}>;
  gridColor: string;
  gridOpacity: number;
  showSafeZone: boolean;
  safeZoneInset: number;   // percentage
}

export const COMPOSITION_GUIDES = [
  { id: 'rule-thirds', name: 'Rule of Thirds', description: 'Divide frame into 3×3 grid. Place subjects at intersections.' },
  { id: 'golden-ratio', name: 'Golden Ratio (Phi)', description: '1.618:1 spiral and rectangles for natural balance.' },
  { id: 'golden-spiral', name: 'Golden Spiral', description: 'Fibonacci spiral leading to focal point.' },
  { id: 'center-cross', name: 'Center Crosshair', description: 'Horizontal and vertical center lines.' },
  { id: 'diagonals', name: 'Diagonal Lines', description: 'Corner-to-corner diagonals for dynamic tension.' },
  { id: 'triangles', name: 'Golden Triangles', description: 'Diagonal + perpendiculars for triangular composition.' },
  { id: 'symmetry', name: 'Symmetry Grid', description: 'Vertical center line with balanced halves.' },
  { id: 'safe-zone', name: 'Safe Zone', description: 'Title/action safe areas for video platforms.' },
  { id: 'perspective-1pt', name: '1-Point Perspective', description: 'Single vanishing point with radial guides.' },
  { id: 'perspective-2pt', name: '2-Point Perspective', description: 'Two vanishing points for architectural depth.' },
  { id: 'headroom', name: 'Headroom Guide', description: 'Eyeline thirds for portrait framing.' },
  { id: 'leading-lines', name: 'Leading Lines', description: 'Curved S-path from foreground to focal point.' },
];

export const moduleDef: ModuleDef = {
  id,
  name: 'Composition Overlay',
  category: 'edit',
  description: 'Generate SVG composition guides overlaid on image previews. Rule of thirds, golden ratio, perspective lines, character position markers, and safe zones. Helps users compose prompts with precise proportions before AI generation.',
  inputs: [
    { id: 'image', label: 'Base Image (optional)', type: 'image', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'overlaySVG', label: 'Overlay SVG', type: 'image', direction: 'output' },
    { id: 'compositionData', label: 'Composition Data', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'guide', label: 'Primary Guide', type: 'enum', options: COMPOSITION_GUIDES.map(g => g.id), default: 'rule-thirds' },
    { id: 'secondaryGuide', label: 'Secondary Guide', type: 'enum', options: ['none', ...COMPOSITION_GUIDES.map(g => g.id)], default: 'none' },
    { id: 'gridColor', label: 'Grid Color', type: 'color', default: '#00d4aa' },
    { id: 'gridOpacity', label: 'Grid Opacity', type: 'number', default: 40, min: 10, max: 100 },
    { id: 'showSafeZone', label: 'Show Safe Zone', type: 'boolean', default: false },
    { id: 'safeZoneInset', label: 'Safe Zone %', type: 'number', default: 10, min: 0, max: 25 },
    { id: 'characterCount', label: 'Character Markers', type: 'number', default: 1, min: 0, max: 5 },
    { id: 'characterPositions', label: 'Positions (JSON)', type: 'string', default: '[{"x":33,"y":66,"label":"Hero"}]' },
    { id: 'width', label: 'Width', type: 'number', default: 1080, min: 256, max: 2048, step: 64 },
    { id: 'height', label: 'Height', type: 'number', default: 1920, min: 256, max: 2048, step: 64 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const W = (ctx.parameters.width as number) || 1080;
    const H = (ctx.parameters.height as number) || 1920;
    const primary = (ctx.parameters.guide as string) || 'rule-thirds';
    const secondary = (ctx.parameters.secondaryGuide as string) || 'none';
    const color = (ctx.parameters.gridColor as string) || '#00d4aa';
    const opacity = ((ctx.parameters.gridOpacity as number) || 40) / 100;
    const showSafe = ctx.parameters.showSafeZone === true;
    const safeInset = (ctx.parameters.safeZoneInset as number) || 10;
    const charCount = (ctx.parameters.characterCount as number) || 1;

    // Parse character positions
    let charMarkers: Array<{x: number; y: number; label: string}> = [];
    try {
      const raw = ctx.parameters.characterPositions as string;
      if (raw) charMarkers = JSON.parse(raw);
    } catch { /* use defaults */ }
    
    if (charMarkers.length === 0 && charCount > 0) {
      // Auto-place markers at rule-of-thirds intersections
      const positions = [
        { x: 33, y: 33 }, { x: 66, y: 33 },
        { x: 33, y: 66 }, { x: 66, y: 66 },
        { x: 50, y: 50 },
      ];
      charMarkers = positions.slice(0, charCount).map((p, i) => ({
        x: p.x, y: p.y, label: `Subject ${i + 1}`,
      }));
    }

    const svg = generateCompositionSVG(W, H, primary, secondary, color, opacity, showSafe, safeInset, charMarkers);
    const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;

    return {
      outputs: { overlaySVG: dataUrl, compositionData: { primary, secondary, charMarkers, width: W, height: H } },
      metadata: { guide: primary, markers: charMarkers.length, dimensions: `${W}×${H}` },
    };
  },
};

function generateCompositionSVG(
  W: number, H: number,
  primary: string, secondary: string,
  color: string, opacity: number,
  showSafe: boolean, safeInset: number,
  markers: Array<{x: number; y: number; label: string}>,
): string {
  const strokeColor = color;
  const strokeOp = opacity;
  const fillOp = opacity * 0.15;
  let guides = '';

  // Rule of Thirds
  if (primary === 'rule-thirds' || secondary === 'rule-thirds') {
    const tx = W / 3, ty = H / 3;
    guides += `<g stroke="${strokeColor}" stroke-width="1" opacity="${primary === 'rule-thirds' ? strokeOp : strokeOp * 0.5}">`;
    guides += `<line x1="${tx}" y1="0" x2="${tx}" y2="${H}"/>`;
    guides += `<line x1="${tx * 2}" y1="0" x2="${tx * 2}" y2="${H}"/>`;
    guides += `<line x1="0" y1="${ty}" x2="${W}" y2="${ty}"/>`;
    guides += `<line x1="0" y1="${ty * 2}" x2="${W}" y2="${ty * 2}"/>`;
    // Intersection dots
    for (const ix of [tx, tx * 2]) {
      for (const iy of [ty, ty * 2]) {
        guides += `<circle cx="${ix}" cy="${iy}" r="4" fill="${strokeColor}" opacity="${strokeOp}"/>`;
      }
    }
    guides += `</g>`;
  }

  // Golden Ratio
  if (primary === 'golden-ratio' || secondary === 'golden-ratio') {
    const phi = 1.618;
    const gw = W / phi;
    const gh = H / phi;
    guides += `<g stroke="${strokeColor}" stroke-width="1" opacity="${primary === 'golden-ratio' ? strokeOp : strokeOp * 0.5}">`;
    guides += `<rect x="${W - gw}" y="0" width="${gw}" height="${H}" fill="${strokeColor}" opacity="${fillOp}"/>`;
    guides += `<rect x="0" y="${H - gh}" width="${W}" height="${gh}" fill="${strokeColor}" opacity="${fillOp * 0.5}"/>`;
    guides += `<line x1="${W - gw}" y1="0" x2="${W - gw}" y2="${H}"/>`;
    guides += `<line x1="0" y1="${H - gh}" x2="${W}" y2="${H - gh}"/>`;
    guides += `<circle cx="${W - gw}" cy="${H - gh}" r="5" fill="${strokeColor}"/>`;
    guides += `</g>`;
  }

  // Golden Spiral
  if (primary === 'golden-spiral' || secondary === 'golden-spiral') {
    const cx = W * 0.382; // phi reciprocal
    const cy = H * 0.618;
    guides += `<g stroke="${strokeColor}" stroke-width="1.5" fill="none" opacity="${strokeOp}">`;
    // Approximate spiral with arcs
    let r = Math.min(W, H) * 0.05;
    let x = cx, y = cy;
    for (let i = 0; i < 8; i++) {
      const nextR = r * 1.618;
      guides += `<path d="M${x},${y} A${r},${r} 0 0,1 ${x + r},${y - r}" />`;
      x += r; y -= r; r = nextR;
    }
    guides += `</g>`;
    guides += `<circle cx="${cx}" cy="${cy}" r="4" fill="${strokeColor}" opacity="${strokeOp}"/>`;
  }

  // Center Crosshair
  if (primary === 'center-cross' || secondary === 'center-cross') {
    guides += `<g stroke="${strokeColor}" stroke-width="1" stroke-dasharray="8,8" opacity="${strokeOp}">`;
    guides += `<line x1="${W / 2}" y1="0" x2="${W / 2}" y2="${H}"/>`;
    guides += `<line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}"/>`;
    guides += `</g>`;
    guides += `<circle cx="${W / 2}" cy="${H / 2}" r="8" fill="none" stroke="${strokeColor}" stroke-width="2" opacity="${strokeOp}"/>`;
  }

  // Diagonals
  if (primary === 'diagonals' || secondary === 'diagonals') {
    guides += `<g stroke="${strokeColor}" stroke-width="0.8" opacity="${strokeOp}">`;
    guides += `<line x1="0" y1="0" x2="${W}" y2="${H}"/>`;
    guides += `<line x1="${W}" y1="0" x2="0" y2="${H}"/>`;
    guides += `</g>`;
  }

  // Perspective 1-point
  if (primary === 'perspective-1pt' || secondary === 'perspective-1pt') {
    const vpX = W / 2, vpY = H * 0.45;
    guides += `<g stroke="${strokeColor}" stroke-width="0.5" opacity="${strokeOp}">`;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      guides += `<line x1="${vpX}" y1="${vpY}" x2="${vpX + Math.cos(angle) * Math.max(W, H)}" y2="${vpY + Math.sin(angle) * Math.max(W, H)}"/>`;
    }
    guides += `</g>`;
    guides += `<circle cx="${vpX}" cy="${vpY}" r="6" fill="${strokeColor}" opacity="${strokeOp}"/>`;
    guides += `<text x="${vpX}" y="${vpY - 14}" text-anchor="middle" fill="${strokeColor}" font-size="10" opacity="${strokeOp}">VP</text>`;
  }

  // Safe Zone
  if (showSafe || primary === 'safe-zone') {
    const insetX = W * safeInset / 100;
    const insetY = H * safeInset / 100;
    guides += `<g stroke="${strokeColor}" stroke-width="1" opacity="0.3">`;
    guides += `<rect x="${insetX}" y="${insetY}" width="${W - insetX * 2}" height="${H - insetY * 2}" fill="none" stroke-dasharray="6,4"/>`;
    guides += `<text x="${W - insetX - 6}" y="${insetY - 6}" text-anchor="end" fill="${strokeColor}" font-size="9" opacity="0.5">Safe Zone ${safeInset}%</text>`;
    guides += `</g>`;
  }

  // Character position markers
  for (const marker of markers) {
    const mx = W * marker.x / 100;
    const my = H * marker.y / 100;
    guides += `<g opacity="0.9">`;
    // Circle marker
    guides += `<circle cx="${mx}" cy="${my}" r="18" fill="none" stroke="${strokeColor}" stroke-width="2"/>`;
    guides += `<circle cx="${mx}" cy="${my}" r="4" fill="${strokeColor}"/>`;
    // Label
    guides += `<text x="${mx}" y="${my - 24}" text-anchor="middle" fill="${strokeColor}" font-size="11" font-weight="600">${marker.label}</text>`;
    // Position cross
    guides += `<line x1="${mx - 22}" y1="${my}" x2="${mx - 14}" y2="${my}" stroke="${strokeColor}" stroke-width="1"/>`;
    guides += `<line x1="${mx + 14}" y1="${my}" x2="${mx + 22}" y2="${my}" stroke="${strokeColor}" stroke-width="1"/>`;
    guides += `<line x1="${mx}" y1="${my - 22}" x2="${mx}" y2="${my - 14}" stroke="${strokeColor}" stroke-width="1"/>`;
    guides += `<line x1="${mx}" y1="${my + 14}" x2="${mx}" y2="${my + 22}" stroke="${strokeColor}" stroke-width="1"/>`;
    guides += `</g>`;
  }

  // Footer
  const footer = `<text x="${W - 10}" y="${H - 8}" text-anchor="end" fill="${strokeColor}" font-size="9" opacity="0.3" font-family="monospace">
    Ars Technic AI • ${primary} • ${W}×${H}
  </text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="100%" fill="transparent"/>
  ${guides}
  ${footer}
</svg>`;
}
