// ============================================================
// ARS TECHNICAI — Time & Space Factors Module
// Adds temporal and spatial context to templates/generations.
// Time: era, season, time-of-day, duration, speed, age
// Space: location, coordinates, scale, depth, perspective
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'intel.time.space';

// ─── Time Factors ──────────────────────────────────────────────────────

export interface TimeFactors {
  era: string;           // prehistoric, ancient, medieval, renaissance, victorian, 1920s, modern, near-future, far-future
  season: string;        // spring, summer, autumn, winter
  timeOfDay: string;     // dawn, morning, midday, afternoon, golden-hour, sunset, dusk, night, midnight
  duration: number;      // scene duration in seconds
  speed: number;         // 0.25x (slow-mo) to 4x (time-lapse)
  age: string;           // newborn, child, teen, young-adult, adult, middle-aged, elderly, ancient
  weather: string;       // clear, cloudy, rain, storm, snow, fog, wind, hail
  progression: 'linear' | 'accelerating' | 'decelerating' | 'cyclical' | 'random';
}

// ─── Space Factors ─────────────────────────────────────────────────────

export interface SpaceFactors {
  location: string;      // indoors, outdoors, urban, rural, space, underwater, fantasy
  coordinates: { x: number; y: number; z: number }; // relative position in scene
  scale: number;         // 0.1 (macro/micro) to 10 (epic/wide)
  depth: number;         // foreground=0, midground=0.5, background=1
  perspective: string;   // wide-angle, normal, telephoto, fisheye, isometric, top-down, POV
  framing: string;       // centered, rule-of-thirds, golden-ratio, diagonal, frame-within-frame
  movement: 'static' | 'pan-left' | 'pan-right' | 'tilt-up' | 'tilt-down' | 'dolly-in' | 'dolly-out' | 'tracking' | 'handheld';
}

// ─── Context Builder ───────────────────────────────────────────────────

export interface TimeSpaceContext {
  time: TimeFactors;
  space: SpaceFactors;
  combinedPrompt: string;
  keywords: string[];
  contrastScore: number;  // how much contrast between space and time (0-1)
}

export const ERA_OPTIONS = ['prehistoric', 'ancient', 'medieval', 'renaissance', 'victorian', '1920s', '1950s', '1980s', 'modern', 'near-future', 'far-future', 'timeless'];
export const SEASON_OPTIONS = ['spring', 'summer', 'autumn', 'winter'];
export const TIME_OPTIONS = ['dawn', 'morning', 'midday', 'afternoon', 'golden-hour', 'sunset', 'dusk', 'night', 'midnight'];
export const PERSPECTIVE_OPTIONS = ['wide-angle', 'normal', 'telephoto', 'fisheye', 'isometric', 'top-down', 'POV'];
export const MOVEMENT_OPTIONS = ['static', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down', 'dolly-in', 'dolly-out', 'tracking', 'handheld'];

export function buildTimeSpacePrompt(factors: TimeSpaceContext): string {
  const { time, space } = factors;
  const parts: string[] = [];

  // Time context
  if (time.era !== 'timeless') parts.push(`${time.era} era`);
  parts.push(`${time.season}, ${time.timeOfDay}`);
  if (time.weather !== 'clear') parts.push(`${time.weather} weather`);
  if (time.speed !== 1) {
    parts.push(time.speed < 1 ? `slow motion ${time.speed}x` : `time-lapse ${time.speed}x`);
  }

  // Space context
  parts.push(`${space.location} setting`);
  parts.push(`${space.perspective} perspective`);
  parts.push(`${space.framing} composition`);
  if (space.scale !== 1) {
    parts.push(space.scale < 1 ? `macro close-up` : `epic wide shot`);
  }
  if (space.depth < 0.3) parts.push('foreground focus');
  else if (space.depth > 0.7) parts.push('deep background');
  if (space.movement !== 'static') parts.push(`${space.movement} camera movement`);

  return parts.join(', ');
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Time & Space Factors',
  category: 'intelligence',
  description: 'Add temporal and spatial context to templates and generations. Time: era, season, time-of-day, duration, speed, age, weather, progression. Space: location, 3D coordinates, scale, depth, perspective, framing, camera movement. Generates combined prompt from factors and computes contrast scores.',
  inputs: [
    { id: 'timeFactors', label: 'Time Factors', type: 'data', direction: 'input', optional: true },
    { id: 'spaceFactors', label: 'Space Factors', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'context', label: 'Time/Space Context', type: 'data', direction: 'output' },
    { id: 'prompt', label: 'Combined Prompt', type: 'text', direction: 'output' },
    { id: 'keywords', label: 'Extracted Keywords', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'era', label: 'Era', type: 'enum', options: ERA_OPTIONS, default: 'modern' },
    { id: 'season', label: 'Season', type: 'enum', options: SEASON_OPTIONS, default: 'spring' },
    { id: 'timeOfDay', label: 'Time of Day', type: 'enum', options: TIME_OPTIONS, default: 'golden-hour' },
    { id: 'weather', label: 'Weather', type: 'enum', options: ['clear', 'cloudy', 'rain', 'storm', 'snow', 'fog', 'wind', 'hail'], default: 'clear' },
    { id: 'duration', label: 'Duration (seconds)', type: 'number', default: 5, min: 1, max: 300 },
    { id: 'speed', label: 'Speed Multiplier', type: 'number', default: 1, min: 0.25, max: 4, step: 0.25 },
    { id: 'location', label: 'Location', type: 'enum', options: ['indoors', 'outdoors', 'urban', 'rural', 'space', 'underwater', 'fantasy', 'abstract'], default: 'outdoors' },
    { id: 'perspective', label: 'Perspective', type: 'enum', options: PERSPECTIVE_OPTIONS, default: 'wide-angle' },
    { id: 'framing', label: 'Framing', type: 'enum', options: ['centered', 'rule-of-thirds', 'golden-ratio', 'diagonal', 'frame-within-frame'], default: 'rule-of-thirds' },
    { id: 'scale', label: 'Scale', type: 'number', default: 1, min: 0.1, max: 10, step: 0.1 },
    { id: 'depth', label: 'Depth Layer', type: 'number', default: 0.5, min: 0, max: 1, step: 0.05 },
    { id: 'movement', label: 'Camera Movement', type: 'enum', options: MOVEMENT_OPTIONS, default: 'static' },
    { id: 'x', label: 'X Position', type: 'number', default: 0, min: -100, max: 100 },
    { id: 'y', label: 'Y Position', type: 'number', default: 0, min: -100, max: 100 },
    { id: 'z', label: 'Z Position (Depth)', type: 'number', default: 0, min: -100, max: 100 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const params = ctx.parameters;
    const timeInput = (ctx.inputs.timeFactors as Partial<TimeFactors>) || {};

    const time: TimeFactors = {
      era: (timeInput.era || params.era || 'modern') as string,
      season: (timeInput.season || params.season || 'spring') as string,
      timeOfDay: (timeInput.timeOfDay || params.timeOfDay || 'golden-hour') as string,
      duration: (timeInput.duration || params.duration || 5) as number,
      speed: (timeInput.speed || params.speed || 1) as number,
      age: (timeInput.age || 'adult') as string,
      weather: (timeInput.weather || params.weather || 'clear') as string,
      progression: (timeInput.progression || 'linear') as TimeFactors['progression'],
    };

    const spaceInput = (ctx.inputs.spaceFactors as Partial<SpaceFactors>) || {};

    const space: SpaceFactors = {
      location: (spaceInput.location || params.location || 'outdoors') as string,
      coordinates: {
        x: (spaceInput.coordinates?.x ?? params.x ?? 0) as number,
        y: (spaceInput.coordinates?.y ?? params.y ?? 0) as number,
        z: (spaceInput.coordinates?.z ?? params.z ?? 0) as number,
      },
      scale: (spaceInput.scale || params.scale || 1) as number,
      depth: (spaceInput.depth || params.depth || 0.5) as number,
      perspective: (spaceInput.perspective || params.perspective || 'wide-angle') as string,
      framing: (spaceInput.framing || params.framing || 'rule-of-thirds') as string,
      movement: (spaceInput.movement || params.movement || 'static') as SpaceFactors['movement'],
    };

    // Compute contrast score: how dramatically different are the space/time settings?
    const contrastScore = computeContrastScore(time, space);
    const keywords = extractKeywords(time, space);
    const context: TimeSpaceContext = {
      time, space,
      combinedPrompt: buildTimeSpacePrompt({ time, space, combinedPrompt: '', keywords: [], contrastScore: 0 }),
      keywords,
      contrastScore,
    };

    return {
      outputs: { context, prompt: context.combinedPrompt, keywords },
      metadata: {
        era: time.era, season: time.season, timeOfDay: time.timeOfDay,
        location: space.location, perspective: space.perspective,
        coordinates: space.coordinates, contrastScore: contrastScore.toFixed(2),
      },
    };
  },
};

function computeContrastScore(time: TimeFactors, space: SpaceFactors): number {
  let score = 0;
  // High contrast: mismatch between era and location (e.g., medieval + space)
  const eraModern = ['modern', 'near-future', 'far-future'].includes(time.era);
  const locAdvanced = ['space', 'underwater'].includes(space.location);
  if (!eraModern && locAdvanced) score += 0.5;
  if (time.weather === 'storm' && space.location === 'indoors') score += 0.3;
  if (time.speed > 2 && space.movement === 'static') score += 0.3;
  if (time.timeOfDay === 'midnight' && space.location === 'outdoors') score += 0.2;
  return Math.min(1, score);
}

function extractKeywords(time: TimeFactors, space: SpaceFactors): string[] {
  const kw: string[] = [];
  if (time.era !== 'modern') kw.push(time.era);
  kw.push(time.season, time.timeOfDay);
  if (time.weather !== 'clear') kw.push(time.weather);
  if (time.speed !== 1) kw.push(time.speed < 1 ? 'slow-motion' : 'time-lapse');
  kw.push(space.location, space.perspective);
  if (space.scale !== 1) kw.push(space.scale < 1 ? 'macro' : 'epic');
  if (space.movement !== 'static') kw.push(space.movement);
  return [...new Set(kw)];
}
