import { describe, expect, it } from 'vitest';
import { childBoxes, optionBox, optionBoxes, packWheelSlices, WHEEL_SIZE, wedgePolygon, type WheelSlice } from '../../lib/pipeline/wheelSlices';

const slice = (id: string): WheelSlice => ({
  id,
  label: id,
  icon: 'image',
  color: '#fff',
  options: [{ id: `${id}-a`, label: id, icon: 'image', color: '#fff' }],
});

describe('packWheelSlices', () => {
  it('keeps a short wheel on the ring', () => {
    const packed = packWheelSlices([slice('a'), slice('b'), slice('c')]);
    expect(packed.ring.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(packed.overflow).toEqual([]);
  });

  it('leaves the sixth place for More when there are more groups', () => {
    const packed = packWheelSlices(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(slice));
    expect(packed.ring.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(packed.overflow.map((item) => item.id)).toEqual(['f', 'g']);
  });

  it('draws a closed pie slice', () => {
    const polygon = wedgePolygon(0, 6);
    expect(polygon.startsWith('polygon(')).toBe(true);
    expect(polygon.endsWith(')')).toBe(true);
  });

  it('follows the rim as a curve centered on the slice', () => {
    const center = WHEEL_SIZE / 2;
    const rim = WHEEL_SIZE * 0.49;
    const angleOf = (box: { left: number; top: number; width: number; height: number }) => (
      Math.atan2(box.top + box.height / 2 - center, box.left + box.width / 2 - center)
    );
    const outside = (box: { left: number; top: number; width: number; height: number }) => {
      const x = Math.min(Math.max(center, box.left), box.left + box.width);
      const y = Math.min(Math.max(center, box.top), box.top + box.height);
      expect(Math.hypot(x - center, y - center)).toBeGreaterThan(rim - 1);
    };
    outside(optionBox(0, 0, 1));
    const pair = [optionBox(0, 0, 2), optionBox(0, 1, 2)];
    expect(pair[0].top).toBeLessThan(pair[1].top);
    for (const mid of [0, Math.PI / 3, Math.PI, -Math.PI / 2]) {
      const boxes = [0, 1, 2, 3].map((index) => optionBox(mid, index, 4));
      boxes.forEach(outside);
      const delta = boxes.map((box) => {
        let turn = angleOf(box) - mid;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        return turn;
      });
      for (let index = 1; index < delta.length; index += 1) {
        expect(delta[index]).toBeGreaterThan(delta[index - 1]);
      }
      expect(Math.abs(delta[0] + delta[delta.length - 1])).toBeLessThan(0.2);
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          const separated = a.left + a.width <= b.left || b.left + b.width <= a.left
            || a.top + a.height <= b.top || b.top + b.height <= a.top;
          expect(separated).toBe(true);
        }
      }
    }
  });

  it('bends the curve back inside the screen', () => {
    const boxes = optionBoxes(0, 3, { minX: -80, minY: -220, maxX: 300, maxY: 500 });
    for (const box of boxes) {
      expect(box.left + box.width).toBeLessThanOrEqual(301);
      expect(box.top).toBeGreaterThanOrEqual(-221);
      expect(box.top + box.height).toBeLessThanOrEqual(501);
    }
  });

  it('opens children past the submenu item, on the same side', () => {
    const center = WHEEL_SIZE / 2;
    const parent = optionBox(0, 0, 1);
    const kids = childBoxes(parent, 0, 2);
    expect(kids[0].top).toBeLessThan(kids[1].top);
    const parentDist = Math.hypot(parent.left + parent.width / 2 - center, parent.top + parent.height / 2 - center);
    for (const kid of kids) {
      const dist = Math.hypot(kid.left + kid.width / 2 - center, kid.top + kid.height / 2 - center);
      expect(dist).toBeGreaterThan(parentDist);
      const separated = kid.left + kid.width <= parent.left || parent.left + parent.width <= kid.left
        || kid.top + kid.height <= parent.top || parent.top + parent.height <= kid.top;
      expect(separated).toBe(true);
    }
  });
});
