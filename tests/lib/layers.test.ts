import { describe, expect, it } from 'vitest';
import { applyGroup, applyUngroup, createLayer, layerDirectives, layerShown } from '../../lib/pipeline/layers';
import type { NodeVariant } from '../../types/pipeline';

function variant(layers: NodeVariant['layers']): NodeVariant {
  return { id: 'v', label: 'v1', createdAt: 1, image: 'data:image/png;base64,xx', layers };
}

describe('layer groups and generator notes', () => {
  it('groups two layers and removes the folder without deleting the marks', () => {
    const text = createLayer('text', { id: 't', text: 'change the bowl' });
    const ink = createLayer('draw', { id: 'd', strokes: [{ color: '#fff', size: 0.01, points: [{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.5 }] }] });
    const group = createLayer('group', { id: 'g', name: 'Edits' });
    const grouped = applyGroup([text, ink], ['t', 'd'], group);
    expect(grouped.map((layer) => layer.id)).toEqual(['t', 'd', 'g']);
    expect(grouped.find((layer) => layer.id === 't')?.parentId).toBe('g');
    const flat = applyUngroup(grouped, 'g');
    expect(flat.map((layer) => layer.id)).toEqual(['t', 'd']);
    expect(flat.every((layer) => !layer.parentId)).toBe(true);
  });

  it('hides a mark when its group is hidden', () => {
    const group = createLayer('group', { id: 'g', visible: false });
    const text = createLayer('text', { id: 't', parentId: 'g', text: 'hello' });
    expect(layerShown(text, [group, text])).toBe(false);
    expect(layerShown({ ...text, parentId: undefined }, [group, text])).toBe(true);
  });

  it('turns written notes, drawings, and groups into instructions for the next generator', () => {
    const group = createLayer('group', { id: 'g', name: 'Bowl change' });
    const text = createLayer('text', { id: 't', parentId: 'g', text: 'replace the bowl with a red vase', x: 0.1, y: 0.2, w: 0.4, h: 0.1 });
    const ink = createLayer('draw', {
      id: 'd',
      parentId: 'g',
      strokes: [{ color: '#ff4d6d', size: 0.01, points: [{ x: 0.4, y: 0.6 }, { x: 0.7, y: 0.8 }] }],
    });
    const note = layerDirectives(variant([text, ink, group]));
    expect(note).toContain('replace the bowl with a red vase');
    expect(note).toContain('Bowl change');
    expect(note).toContain('drawing marks');
  });

  it('leaves a hidden note out of the generator instructions', () => {
    const text = createLayer('text', { id: 't', text: 'secret', visible: false });
    expect(layerDirectives(variant([text]))).toBe('');
  });
});
