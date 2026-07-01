// ============================================================
// ARS TECHNICAI — Drawing Module
// Simplified drawing/painting tools: brush, eraser, shapes,
// text, color picker, layers. Photoshop-like basics for AI.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.drawing';

export interface DrawingTool {
  id: string;
  name: string;
  type: 'brush' | 'eraser' | 'shape' | 'text' | 'fill' | 'picker' | 'line' | 'select';
  icon: string;
  shortcut: string;
}

export const DRAWING_TOOLS: DrawingTool[] = [
  { id: 'brush', name: 'Brush', type: 'brush', icon: 'paintbrush', shortcut: 'B' },
  { id: 'eraser', name: 'Eraser', type: 'eraser', icon: 'eraser', shortcut: 'E' },
  { id: 'fill', name: 'Fill', type: 'fill', icon: 'paint-bucket', shortcut: 'G' },
  { id: 'rectangle', name: 'Rectangle', type: 'shape', icon: 'square', shortcut: 'R' },
  { id: 'ellipse', name: 'Ellipse', type: 'shape', icon: 'circle', shortcut: 'O' },
  { id: 'line', name: 'Line', type: 'line', icon: 'minus', shortcut: 'L' },
  { id: 'text', name: 'Text', type: 'text', icon: 'type', shortcut: 'T' },
  { id: 'picker', name: 'Color Picker', type: 'picker', icon: 'pipette', shortcut: 'I' },
  { id: 'select', name: 'Select', type: 'select', icon: 'pointer', shortcut: 'V' },
];

export interface DrawingLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay';
  data?: string; // base64 image data
}

export interface DrawingState {
  tool: string;
  color: string;
  brushSize: number;
  opacity: number;
  layers: DrawingLayer[];
  activeLayer: string;
  width: number;
  height: number;
  backgroundColor: string;
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Drawing Tools',
  category: 'edit',
  description: 'Simplified drawing and painting tools: brush, eraser, shapes, text, color picker, layers. Create sketches, annotations, masks, and composition guides for AI generation.',
  inputs: [
    { id: 'image', label: 'Base Image', type: 'image', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'drawing', label: 'Drawing Result', type: 'image', direction: 'output' },
    { id: 'layers', label: 'Layer Data', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'tool', label: 'Active Tool', type: 'enum', options: ['brush', 'eraser', 'fill', 'rectangle', 'ellipse', 'line', 'text', 'picker', 'select'], default: 'brush' },
    { id: 'color', label: 'Color', type: 'color', default: '#ffffff' },
    { id: 'brushSize', label: 'Brush Size', type: 'number', default: 10, min: 1, max: 200, step: 1 },
    { id: 'opacity', label: 'Opacity', type: 'number', default: 100, min: 1, max: 100 },
    { id: 'width', label: 'Canvas Width', type: 'number', default: 1024, min: 64, max: 4096, step: 64 },
    { id: 'height', label: 'Canvas Height', type: 'number', default: 1024, min: 64, max: 4096, step: 64 },
    { id: 'backgroundColor', label: 'Background Color', type: 'color', default: '#1a1a2e' },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const params = ctx.parameters;
    const state: DrawingState = {
      tool: (params.tool as string) || 'brush',
      color: (params.color as string) || '#ffffff',
      brushSize: (params.brushSize as number) || 10,
      opacity: (params.opacity as number) || 100,
      layers: [{ id: 'bg', name: 'Background', visible: true, locked: true, opacity: 100, blendMode: 'normal' }],
      activeLayer: 'bg',
      width: (params.width as number) || 1024,
      height: (params.height as number) || 1024,
      backgroundColor: (params.backgroundColor as string) || '#1a1a2e',
    };
    
    return {
      outputs: { drawing: null, layers: state.layers, tools: DRAWING_TOOLS },
      metadata: { toolsAvailable: DRAWING_TOOLS.length, canvasSize: `${state.width}x${state.height}` },
    };
  },
};
