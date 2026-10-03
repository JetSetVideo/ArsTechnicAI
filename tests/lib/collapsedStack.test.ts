import { describe, expect, it } from 'vitest';
import { PIPELINE_NODE_DEFS } from '../../lib/pipeline/catalog';
import { collapsedStack, foldBackgroundAlpha } from '../../components/workshop/laneFrames';
import { wiringFor } from '../../components/workshop/groupCycles';
import type { PipelineEdge, PipelineNode } from '../../types/pipeline';

const step = (cards: { shiftX: number }[], index: number) => cards[index].shiftX - cards[index - 1].shiftX;

describe('closed group stack', () => {
  it('keeps a smaller horizontal step on deeper cards, and smaller still in a larger group', () => {
    const few = collapsedStack(3);
    const many = collapsedStack(8);
    expect(few[0].shiftX).toBe(0);
    expect(step(few, 1)).toBeGreaterThan(step(few, 2));
    expect(step(many, 7)).toBeLessThan(step(few, 1));
    expect(step(few, 1)).toBeLessThan(8);
  });

  it('makes cards further back more transparent after the cards in front', () => {
    expect(foldBackgroundAlpha(2, 4)).toBeLessThan(foldBackgroundAlpha(1, 4));
    expect(foldBackgroundAlpha(1, 4)).toBeLessThan(foldBackgroundAlpha(0, 4));
    const stack = collapsedStack(4);
    expect(stack[3].alpha).toBeLessThan(stack[0].alpha);
  });
});

describe('closed group wiring', () => {
  it('counts links that leave the group separately from links that stay inside', () => {
    const [inside, also, outside] = Object.values(PIPELINE_NODE_DEFS).slice(0, 3);
    const nodes = [
      { id: 'a', type: inside.type },
      { id: 'b', type: also.type },
      { id: 'c', type: outside.type },
    ] as PipelineNode[];
    const edges = [
      { id: 'in', from: 'a', fromPort: inside.outputs[0]?.id ?? 'out', to: 'b', toPort: also.inputs[0]?.id ?? 'in', type: 'any' },
      { id: 'out', from: 'b', fromPort: also.outputs[0]?.id ?? 'out', to: 'c', toPort: outside.inputs[0]?.id ?? 'in', type: 'any' },
    ] as PipelineEdge[];
    const wiring = wiringFor(['a', 'b'], nodes, edges);
    expect(wiring.internal).toBe(1);
    expect(wiring.external).toBe(1);
    const linked = [...wiring.inputs, ...wiring.outputs].filter((cycle) => cycle.role !== 'empty');
    expect(linked.some((cycle) => cycle.role === 'internal')).toBe(true);
    expect(linked.some((cycle) => cycle.role === 'external')).toBe(true);
  });
});
