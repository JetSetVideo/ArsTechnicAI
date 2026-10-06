/** A bullseye stays readable at six slices. Anything past that opens from More. */
export const WHEEL_MAX_SLICES = 6;

export interface WheelOption {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  color: string;
}

export interface WheelSlice {
  id: string;
  label: string;
  icon: string;
  color: string;
  options: WheelOption[];
}

export function packWheelSlices(
  slices: WheelSlice[],
  max = WHEEL_MAX_SLICES,
): { ring: WheelSlice[]; overflow: WheelSlice[] } {
  if (slices.length <= max) return { ring: slices, overflow: [] };
  return { ring: slices.slice(0, max - 1), overflow: slices.slice(max - 1) };
}

/** Pie slice from an inner radius to the rim, with a gap so the cuts stay visible. */
export function wedgePolygon(
  index: number,
  count: number,
  inner = 13,
  outer = 49,
  gap = 0.04,
): string {
  const start = -Math.PI / 2 + (index / count) * Math.PI * 2 + gap;
  const end = -Math.PI / 2 + ((index + 1) / count) * Math.PI * 2 - gap;
  const steps = 10;
  const arc = (radius: number, from: number, to: number) => {
    const pts: string[] = [];
    for (let step = 0; step <= steps; step += 1) {
      const angle = from + (to - from) * (step / steps);
      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius;
      pts.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
    }
    return pts;
  };
  const outerArc = arc(outer, start, end);
  const innerArc = arc(inner, end, start);
  return `polygon(${[...outerArc, ...innerArc].join(', ')})`;
}

export function wedgeMidAngle(index: number, count: number): number {
  return -Math.PI / 2 + ((index + 0.5) / count) * Math.PI * 2;
}

export const WHEEL_SIZE = 280;
const OPTION_W = 140;
const OPTION_H = 34;
const OPTION_GAP = 6;
const RIM = WHEEL_SIZE * 0.49 + 6;

export interface OptionBox { left: number; top: number; width: number; height: number }

/** Wheel-local bounds. The curve bends inward when a choice would leave this rectangle. */
export interface MenuSpace {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function boxAt(angle: number, radius: number): OptionBox {
  const center = WHEEL_SIZE / 2;
  const cx = center + Math.cos(angle) * radius;
  const cy = center + Math.sin(angle) * radius;
  return { left: cx - OPTION_W / 2, top: cy - OPTION_H / 2, width: OPTION_W, height: OPTION_H };
}

/** Center distance that keeps the chip's inner edge just outside the rim. */
function hugRadius(angle: number): number {
  return RIM
    + (OPTION_W / 2) * Math.abs(Math.cos(angle))
    + (OPTION_H / 2) * Math.abs(Math.sin(angle));
}

function hitsCircle(box: OptionBox): boolean {
  const center = WHEEL_SIZE / 2;
  const x = Math.min(Math.max(center, box.left), box.left + box.width);
  const y = Math.min(Math.max(center, box.top), box.top + box.height);
  return Math.hypot(x - center, y - center) < WHEEL_SIZE * 0.49;
}

function overlaps(a: OptionBox, b: OptionBox): boolean {
  return a.left < b.left + b.width + OPTION_GAP
    && a.left + a.width + OPTION_GAP > b.left
    && a.top < b.top + b.height + OPTION_GAP
    && a.top + a.height + OPTION_GAP > b.top;
}

function blocked(boxes: OptionBox[], obstacles: OptionBox[]): boolean {
  return boxes.some((box, index) => (
    hitsCircle(box)
    || obstacles.some((other) => overlaps(box, other))
    || boxes.slice(index + 1).some((other) => overlaps(box, other))
  ));
}

/** A curve centered on the rim midpoint. The middle choice kisses the rim; the ends flare only enough to stay apart. */
function flare(
  centerAngle: number,
  count: number,
  radiusAt: (angle: number, pad: number) => number,
  obstacles: OptionBox[],
): OptionBox[] {
  const along = OPTION_W * Math.abs(Math.sin(centerAngle)) + OPTION_H * Math.abs(Math.cos(centerAngle)) + OPTION_GAP;
  const step = Math.min(0.4, along / Math.max(120, radiusAt(centerAngle, 0)));
  const boxes: OptionBox[] = [];
  const order = Array.from({ length: count }, (_, index) => index)
    .sort((a, b) => Math.abs(a - (count - 1) / 2) - Math.abs(b - (count - 1) / 2));
  for (const index of order) {
    const angle = centerAngle + (index - (count - 1) / 2) * step;
    let pad = 0;
    let box = boxAt(angle, radiusAt(angle, pad));
    while (pad < 240 && (hitsCircle(box) || obstacles.some((other) => overlaps(box, other)) || boxes.some((other) => overlaps(box, other)))) {
      pad += 4;
      box = boxAt(angle, radiusAt(angle, pad));
    }
    boxes[index] = box;
  }
  return boxes;
}

function overflow(boxes: OptionBox[], space?: MenuSpace): number {
  if (!space) return 0;
  return boxes.reduce((sum, box) => (
    sum
    + Math.max(0, space.minX - box.left)
    + Math.max(0, box.left + box.width - space.maxX)
    + Math.max(0, space.minY - box.top)
    + Math.max(0, box.top + box.height - space.maxY)
  ), 0);
}

function fitsBox(box: OptionBox, space: MenuSpace | undefined, obstacles: OptionBox[], placed: OptionBox[]): boolean {
  return !hitsCircle(box)
    && overflow(placed.concat(box), space) === overflow(placed, space)
    && !obstacles.some((other) => overlaps(box, other))
    && !placed.some((other) => overlaps(box, other));
}

/** Which way along the rim reaches a chip that fits sooner, and with more spare room. */
function freeDirection(mid: number, space: MenuSpace): number {
  const room = (sign: number) => {
    let nearest = -Infinity;
    for (let step = 0.25; step <= 2.4; step += 0.12) {
      const box = boxAt(mid + sign * step, hugRadius(mid + sign * step));
      if (hitsCircle(box) || overflow([box], space) > 0) {
        nearest = Math.max(nearest, -overflow([box], space));
        continue;
      }
      const slack = Math.min(
        box.left - space.minX,
        space.maxX - (box.left + box.width),
        box.top - space.minY,
        space.maxY - (box.top + box.height),
      );
      return 1000 - step * 80 + Math.min(slack, 120);
    }
    return nearest;
  };
  return room(1) >= room(-1) ? 1 : -1;
}

function stepAt(angle: number, radius: number): number {
  const along = OPTION_W * Math.abs(Math.sin(angle)) + OPTION_H * Math.abs(Math.cos(angle)) + OPTION_GAP;
  return Math.min(0.42, along / Math.max(120, radius));
}

/**
 * One smooth curve on the rim. It stays centered on the slice while that fits.
 * Against a screen edge it keeps the first chip as close to that midpoint as
 * the canvas allows, and the rest follow the perimeter into the open side.
 */
function chooseArc(
  mid: number,
  count: number,
  radiusAt: (angle: number, pad: number) => number,
  space: MenuSpace | undefined,
  obstacles: OptionBox[],
): OptionBox[] {
  const centered = flare(mid, count, radiusAt, obstacles);
  if (!space || (overflow(centered, space) === 0 && !blocked(centered, obstacles))) return centered;
  const dir = freeDirection(mid, space);
  for (let bias = 0.12; bias <= 0.85; bias += 0.12) {
    const boxes = flare(mid + dir * bias, count, radiusAt, obstacles);
    if (overflow(boxes, space) === 0 && !blocked(boxes, obstacles)) return boxes;
  }

  let anchor = mid;
  for (let hop = 0; hop < 26; hop += 1) {
    const box = boxAt(anchor, radiusAt(anchor, 0));
    if (!hitsCircle(box) && overflow([box], space) === 0 && !obstacles.some((other) => overlaps(box, other))) break;
    anchor += dir * 0.09;
  }

  const boxes: OptionBox[] = [];
  let angle = anchor;
  for (let index = 0; index < count; index += 1) {
    let pad = 0;
    let box = boxAt(angle, radiusAt(angle, pad));
    for (let guard = 0; guard < 48; guard += 1) {
      let placed = false;
      pad = 0;
      for (; pad <= 32; pad += 4) {
        box = boxAt(angle, radiusAt(angle, pad));
        if (fitsBox(box, space, obstacles, boxes)) {
          placed = true;
          break;
        }
        if (overflow([box], space) > 0) break;
      }
      if (placed) break;
      angle += dir * 0.06;
      box = boxAt(angle, radiusAt(angle, 0));
    }
    boxes[index] = box;
    angle += dir * Math.max(0.12, stepAt(angle, radiusAt(angle, pad)) * 0.45);
  }
  return boxes;
}

/** Choices follow a curve centered on the outer middle of the open slice. */
export function optionBoxes(mid: number, count: number, space?: MenuSpace): OptionBox[] {
  if (count <= 0) return [];
  return chooseArc(mid, count, (angle, pad) => hugRadius(angle) + pad, space, []);
}

export function optionBox(mid: number, index: number, count: number, space?: MenuSpace): OptionBox {
  return optionBoxes(mid, count, space)[index];
}

/** The bridge is larger than the wheel so the pointer can leave the pie without the menu closing. */
export const MENU_BRIDGE_PAD = 420;

/** Invisible hit area from the rim out past the chips, so the pointer can travel the curve. */
export function menuBridge(mid: number, boxes: OptionBox[]): string {
  if (boxes.length === 0) return '';
  const wheelCenter = WHEEL_SIZE / 2;
  const center = MENU_BRIDGE_PAD + wheelCenter;
  const turn = (angle: number) => {
    let delta = angle - mid;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
  };
  const turns = boxes.map((box) => turn(Math.atan2(
    box.top + box.height / 2 - wheelCenter,
    box.left + box.width / 2 - wheelCenter,
  )));
  const from = mid + Math.min(0, ...turns) - 0.18;
  const to = mid + Math.max(0, ...turns) + 0.18;
  const outer = Math.max(...boxes.map((box) => (
    Math.hypot(box.left + box.width / 2 - wheelCenter, box.top + box.height / 2 - wheelCenter)
  ))) + 86;
  const inner = WHEEL_SIZE * 0.46;
  const steps = 14;
  const arc = (radius: number, start: number, end: number) => {
    const pts: string[] = [];
    for (let step = 0; step <= steps; step += 1) {
      const angle = start + (end - start) * (step / steps);
      pts.push(`${(center + Math.cos(angle) * radius).toFixed(1)}px ${(center + Math.sin(angle) * radius).toFixed(1)}px`);
    }
    return pts;
  };
  return `polygon(${[...arc(outer, from, to), ...arc(inner, to, from)].join(', ')})`;
}

/** Children continue on the next curve out, away from the submenu they opened from. */
export function childBoxes(
  parent: OptionBox,
  _mid: number,
  count: number,
  space?: MenuSpace,
  family: OptionBox[] = [parent],
): OptionBox[] {
  if (count <= 0) return [];
  const center = WHEEL_SIZE / 2;
  const px = parent.left + parent.width / 2 - center;
  const py = parent.top + parent.height / 2 - center;
  const origin = Math.atan2(py, px);
  const parentDist = Math.hypot(px, py);
  const parentSupport = (OPTION_W / 2) * Math.abs(Math.cos(origin)) + (OPTION_H / 2) * Math.abs(Math.sin(origin));
  const radiusAt = (angle: number, pad: number) => {
    const support = (OPTION_W / 2) * Math.abs(Math.cos(angle)) + (OPTION_H / 2) * Math.abs(Math.sin(angle));
    return Math.max(parentDist + parentSupport + support + 12, hugRadius(angle)) + pad;
  };
  const others = family.filter((box) => box !== parent);
  let dir = space ? freeDirection(origin, space) : 1;
  if (others.length > 0) {
    const sx = others.reduce((sum, box) => sum + (box.left + box.width / 2 - center), 0);
    const sy = others.reduce((sum, box) => sum + (box.top + box.height / 2 - center), 0);
    let turn = Math.atan2(sy, sx) - origin;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    dir = turn >= 0 ? -1 : 1;
  }
  const centered = flare(origin, count, radiusAt, family);
  if (others.length === 0 && overflow(centered, space) === 0 && !blocked(centered, family)) return centered;

  const boxes: OptionBox[] = [];
  let angle = origin;
  for (let index = 0; index < count; index += 1) {
    let box = boxAt(angle, radiusAt(angle, 0));
    for (let guard = 0; guard < 36; guard += 1) {
      let placed = false;
      for (let pad = 0; pad <= 48; pad += 4) {
        box = boxAt(angle, radiusAt(angle, pad));
        if (fitsBox(box, space, family, boxes)) {
          placed = true;
          break;
        }
        if (overflow([box], space) > 0) break;
      }
      if (placed) break;
      angle += dir * 0.08;
    }
    boxes[index] = box;
    angle += dir * Math.max(0.14, stepAt(angle, radiusAt(angle, 0)) * 0.55);
  }
  return boxes;
}
