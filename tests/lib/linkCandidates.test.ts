import { describe, expect, it } from 'vitest';
import { linkCandidates, portsCompatible, PIPELINE_NODE_DEFS } from '../../lib/pipeline/catalog';

describe('linkCandidates', () => {
  it('offers image inputs from an image output, with the source stage first', () => {
    const list = linkCandidates('image', 'input', 'visual');
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].stage).toBe('visual');
    expect(list.some((item) => item.type === 'image-edit' && item.portId === 'image')).toBe(true);
    expect(list.some((item) => item.type === 'audio-import')).toBe(false);
    for (const item of list) {
      const def = PIPELINE_NODE_DEFS[item.type];
      const port = def.inputs.find((entry) => entry.id === item.portId);
      expect(port && portsCompatible('image', port.type)).toBe(true);
    }
  });

  it('offers image outputs when the drag starts on an image input', () => {
    const list = linkCandidates('image', 'output', 'visual');
    expect(list.some((item) => item.type === 'image-import')).toBe(true);
    expect(list.every((item) => {
      const port = PIPELINE_NODE_DEFS[item.type].outputs.find((entry) => entry.id === item.portId);
      return !!port && portsCompatible(port.type, 'image');
    })).toBe(true);
    const visual = list.findIndex((item) => item.stage === 'visual');
    const later = list.findIndex((item) => item.stage !== 'visual' && item.stage !== 'storyboard');
    if (visual >= 0 && later >= 0) expect(visual).toBeLessThan(later);
  });
});
