// ============================================================
// ARS TECHNICAI — Comic Page Layout Module (ART-013)
// Arrange 1-6 illustrations per page with gutters and panels.
// Supports manga, western, grid, and splash layouts.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'asm.comic.layout.v2';

export interface ComicPanel {
  id: string;
  imageUrl: string;
  x: number; y: number; width: number; height: number;
  dialogueBalloons: DialogueBalloon[];
  caption?: string;
  soundEffect?: { text: string; style: string; x: number; y: number };
}

export interface DialogueBalloon {
  text: string;
  character: string;
  style: 'round' | 'cloud' | 'spiky' | 'thought' | 'rectangular';
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center';
  tailDirection: 'left' | 'right' | 'down' | 'up';
}

export interface ComicPage {
  id: string;
  pageNumber: number;
  layout: 'single' | '2-horizontal' | '2-vertical' | '3-lshape' | '4-grid' | '6-grid' | 'manga';
  width: number;
  height: number;
  gutterWidth: number;
  gutterColor: string;
  backgroundColor: string;
  panels: ComicPanel[];
}

export const LAYOUT_DEFS: Record<string, { cols: number; rows: number; panels: Array<{ x: number; y: number; w: number; h: number }> }> = {
  'single': { cols: 1, rows: 1, panels: [{ x: 0, y: 0, w: 1, h: 1 }] },
  '2-horizontal': { cols: 2, rows: 1, panels: [{ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 1 }] },
  '2-vertical': { cols: 1, rows: 2, panels: [{ x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 1, w: 1, h: 1 }] },
  '3-lshape': { cols: 2, rows: 2, panels: [{ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 2 }] },
  '4-grid': { cols: 2, rows: 2, panels: [{ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 1 }, { x: 0, y: 1, w: 1, h: 1 }, { x: 1, y: 1, w: 1, h: 1 }] },
  '6-grid': { cols: 3, rows: 2, panels: Array.from({ length: 6 }, (_, i) => ({ x: i % 3, y: Math.floor(i / 3), w: 1, h: 1 })) },
  'manga': { cols: 2, rows: 3, panels: [
    { x: 0, y: 0, w: 2, h: 1 }, { x: 0, y: 1, w: 1, h: 1 }, { x: 1, y: 1, w: 1, h: 1 },
    { x: 0, y: 2, w: 1, h: 1 }, { x: 1, y: 2, w: 1, h: 1 },
  ]},
};

export const moduleDef: ModuleDef = {
  id,
  name: 'Comic Page Layout',
  category: 'assembly',
  description: 'Arrange 1-6 illustrations per comic page with configurable gutters and layout presets. 7 layouts: single, horizontal, vertical, L-shape, 4-grid, 6-grid, manga. Supports dialogue balloons, captions, and sound effects.',
  inputs: [
    { id: 'images', label: 'Image URLs', type: 'data', direction: 'input' },
    { id: 'dialogues', label: 'Dialogue Data', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'comicPage', label: 'Comic Page SVG', type: 'image', direction: 'output' },
    { id: 'pageData', label: 'Page Layout Data', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'layout', label: 'Layout', type: 'enum', options: ['single', '2-horizontal', '2-vertical', '3-lshape', '4-grid', '6-grid', 'manga'], default: '4-grid' },
    { id: 'width', label: 'Page Width', type: 'number', default: 1200, min: 400, max: 4096, step: 100 },
    { id: 'height', label: 'Page Height', type: 'number', default: 1600, min: 400, max: 4096, step: 100 },
    { id: 'gutterWidth', label: 'Gutter Width (px)', type: 'number', default: 12, min: 0, max: 60 },
    { id: 'gutterColor', label: 'Gutter Color', type: 'color', default: '#ffffff' },
    { id: 'backgroundColor', label: 'Page Background', type: 'color', default: '#1a1a1a' },
    { id: 'pageNumber', label: 'Page Number', type: 'number', default: 1, min: 1 },
    { id: 'includePageNumber', label: 'Show Page Number', type: 'boolean', default: true },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const layoutId = (ctx.parameters.layout as string) || '4-grid';
    const width = (ctx.parameters.width as number) || 1200;
    const height = (ctx.parameters.height as number) || 1600;
    const gutter = (ctx.parameters.gutterWidth as number) || 12;
    const gutterColor = (ctx.parameters.gutterColor as string) || '#ffffff';
    const bgColor = (ctx.parameters.backgroundColor as string) || '#1a1a1a';
    const pageNum = (ctx.parameters.pageNumber as number) || 1;
    const showPageNum = ctx.parameters.includePageNumber !== false;

    const imageUrls = (ctx.inputs.images as string[]) || [];
    const dialogues = (ctx.inputs.dialogues as any[]) || [];
    const layoutDef = LAYOUT_DEFS[layoutId] || LAYOUT_DEFS['4-grid'];

    // Calculate panel positions
    const usableWidth = width - gutter * (layoutDef.cols + 1);
    const usableHeight = height - gutter * (layoutDef.rows + 1) - (showPageNum ? 30 : 0);
    const panelW = usableWidth / layoutDef.cols;
    const panelH = usableHeight / layoutDef.rows;

    const panels: ComicPanel[] = [];
    for (let i = 0; i < Math.min(layoutDef.panels.length, imageUrls.length); i++) {
      const p = layoutDef.panels[i];
      const px = gutter + p.x * (panelW + gutter);
      const py = gutter + p.y * (panelH + gutter);
      const pw = p.w * panelW + (p.w - 1) * gutter;
      const ph = p.h * panelH + (p.h - 1) * gutter;

      // Match dialogue to this panel
      const panelDialogues: DialogueBalloon[] = [];
      if (dialogues[i]) {
        panelDialogues.push({
          text: dialogues[i].text || '',
          character: dialogues[i].character || '',
          style: (dialogues[i].style as DialogueBalloon['style']) || 'round',
          position: (dialogues[i].position as DialogueBalloon['position']) || 'bottom-left',
          tailDirection: 'left',
        });
      }

      panels.push({
        id: `panel-${i + 1}`,
        imageUrl: imageUrls[i] || '',
        x: px, y: py, width: pw, height: ph,
        dialogueBalloons: panelDialogues,
      });
    }

    // Generate SVG
    const svg = generateComicPageSVG(width, height, panels, layoutDef, gutter, gutterColor, bgColor, pageNum, showPageNum);
    const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;

    const page: ComicPage = {
      id: `page-${pageNum}`,
      pageNumber: pageNum,
      layout: layoutId as ComicPage['layout'],
      width, height, gutterWidth: gutter, gutterColor, backgroundColor: bgColor, panels,
    };

    return {
      outputs: { comicPage: dataUrl, pageData: page },
      metadata: { layout: layoutId, pageNumber: pageNum, panelCount: panels.length },
    };
  },
};

function generateComicPageSVG(
  w: number, h: number,
  panels: ComicPanel[],
  layoutDef: typeof LAYOUT_DEFS[string],
  gutter: number,
  gutterColor: string,
  bgColor: string,
  pageNum: number,
  showPageNum: boolean,
): string {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="${bgColor}"/>`;

  // Panel frames with images
  for (const panel of panels) {
    // Panel border
    svg += `
  <rect x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}"
    fill="#111" stroke="${gutterColor}" stroke-width="${gutter}"/>`;
    
    // Image placeholder or actual image
    if (panel.imageUrl) {
      svg += `
  <image href="${panel.imageUrl}" x="${panel.x + 2}" y="${panel.y + 2}"
    width="${panel.width - 4}" height="${panel.height - 4}" preserveAspectRatio="xMidYMid slice"/>`;
    } else {
      svg += `
  <text x="${panel.x + panel.width/2}" y="${panel.y + panel.height/2}"
    text-anchor="middle" fill="#444" font-size="18" font-family="monospace">Panel</text>`;
    }

    // Dialogue balloons
    for (const balloon of panel.dialogueBalloons) {
      svg += renderBalloon(balloon, panel);
    }
  }

  // Page number
  if (showPageNum) {
    svg += `
  <text x="${w/2}" y="${h - 10}" text-anchor="middle" fill="#666" font-size="11" font-family="monospace">— ${pageNum} —</text>`;
  }

  svg += '\n</svg>';
  return svg;
}

function renderBalloon(balloon: DialogueBalloon, panel: ComicPanel): string {
  const bx = panel.x + 10;
  const by = balloon.position.includes('top') ? panel.y + 10 : panel.y + panel.height - 60;
  const bw = Math.min(panel.width - 20, 200);
  const bh = 50;

  let balloonPath = '';
  switch (balloon.style) {
    case 'round':
      balloonPath = `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="15" fill="white" stroke="#333" stroke-width="1.5"/>`;
      break;
    case 'cloud':
      balloonPath = `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="20" fill="white" stroke="#333" stroke-width="1.5"/>`;
      // Cloud bumps
      for (let i = 0; i < 4; i++) {
        balloonPath += `<circle cx="${bx + 10 + i * (bw/4)}" cy="${by}" r="8" fill="white" stroke="#333" stroke-width="1.5"/>`;
      }
      break;
    case 'spiky':
      balloonPath = `<polygon points="${bx},${by+bh/2} ${bx+10},${by} ${bx+bw/2},${by-5} ${bx+bw-10},${by} ${bx+bw},${by+bh/2} ${bx+bw-10},${by+bh} ${bx+bw/2},${by+bh+5} ${bx+10},${by+bh}" fill="white" stroke="#333" stroke-width="1.5"/>`;
      break;
    case 'thought':
      balloonPath = `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="25" fill="white" stroke="#999" stroke-width="1" stroke-dasharray="4,4"/>`;
      break;
    case 'rectangular':
      balloonPath = `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3" fill="white" stroke="#333" stroke-width="2"/>`;
      break;
  }

  const lines = balloon.text.match(/.{1,25}/g) || [balloon.text];
  let textY = by + 18;
  let textSvg = '';
  for (const line of lines.slice(0, 3)) {
    textSvg += `<text x="${bx + bw/2}" y="${textY}" text-anchor="middle" fill="#111" font-size="11" font-family="sans-serif">${line}</text>`;
    textY += 14;
  }

  return balloonPath + textSvg;
}
