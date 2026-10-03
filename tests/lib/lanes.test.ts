import { describe, expect, it } from 'vitest';
import { insertionIndex, rectsOverlap, showStageLane, stageAtPoint } from '../../lib/pipeline/lanes';

const picture = (stage: 'concept' | 'visual', inLane?: boolean) => ({
  id: stage + String(inLane),
  type: 'image-import',
  stage,
  inLane,
});

describe('stage lanes', () => {
  it('hides the moodboard until two imported pictures belong to it', () => {
    expect(showStageLane([picture('concept')], 'concept')).toBe(false);
    expect(showStageLane([picture('concept'), picture('concept')], 'concept')).toBe(true);
  });

  it('still opens the moodboard for a single generated concept node', () => {
    expect(showStageLane([{ id: 'm', type: 'moodboard-gen', stage: 'concept' }], 'concept')).toBe(true);
  });

  it('does not open a lane for a picture left on the open canvas', () => {
    expect(showStageLane([picture('visual', false)], 'visual')).toBe(false);
    expect(showStageLane([picture('visual', false), { id: 'k', type: 'keyframe-gen', stage: 'visual' }], 'visual')).toBe(true);
  });

  it('names the lane under a point and ignores the rest', () => {
    const frames = [{ stage: 'concept' as const, x: 0, y: 0, w: 340, h: 352 }];
    expect(stageAtPoint(20, 40, frames)).toBe('concept');
    expect(stageAtPoint(400, 40, frames)).toBeNull();
  });

  it('inserts above the member whose midpoint the pointer has not passed', () => {
    expect(insertionIndex(100, 3, 76, 200, 56)).toBe(0);
    expect(insertionIndex(200, 3, 76, 200, 56)).toBe(1);
    expect(insertionIndex(900, 3, 76, 200, 56)).toBe(3);
  });

  it('treats overlapping cards as a drop onto each other', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 100, h: 100 }, { x: 50, y: 50, w: 100, h: 100 })).toBe(true);
    expect(rectsOverlap({ x: 0, y: 0, w: 40, h: 40 }, { x: 80, y: 80, w: 40, h: 40 })).toBe(false);
  });
});
