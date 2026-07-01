// ============================================================
// ARS TECHNICAI — Scene Transitions Module
// Fade, dissolve, wipe, slide, zoom transitions between scenes.
// Configurable duration, easing, and direction.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'edit.transition.v2';

export type TransitionType = 'fade' | 'dissolve' | 'wipe-left' | 'wipe-right' | 'wipe-up' | 'wipe-down' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out' | 'crossfade' | 'glitch';

export interface TransitionConfig {
  type: TransitionType;
  duration: number;       // seconds
  easing: string;          // ease-in-out, linear, ease-in, ease-out
  fromScene: string;
  toScene: string;
  params: Record<string, number>;
}

export interface TransitionTimeline {
  scenes: Array<{ id: string; startTime: number; endTime: number }>;
  transitions: Array<TransitionConfig & { atTime: number }>;
  totalDuration: number;
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Scene Transitions',
  category: 'edit',
  description: 'Create smooth transitions between scenes. 12 transition types: fade, dissolve, wipe (4 directions), slide (2 directions), zoom (in/out), crossfade, glitch. Configurable duration, easing curves, and transition timing.',
  inputs: [
    { id: 'scenes', label: 'Scene Data', type: 'data', direction: 'input' },
    { id: 'sceneDurations', label: 'Scene Durations (seconds)', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'timeline', label: 'Transition Timeline', type: 'data', direction: 'output' },
    { id: 'transitionConfig', label: 'Transition Config', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'transitionType', label: 'Transition Type', type: 'enum', options: [
      'fade', 'dissolve', 'wipe-left', 'wipe-right', 'wipe-up', 'wipe-down',
      'slide-left', 'slide-right', 'zoom-in', 'zoom-out', 'crossfade', 'glitch',
    ], default: 'fade' },
    { id: 'duration', label: 'Duration (seconds)', type: 'number', default: 1, min: 0.1, max: 5, step: 0.1 },
    { id: 'easing', label: 'Easing', type: 'enum', options: ['ease-in-out', 'linear', 'ease-in', 'ease-out', 'cubic-bezier'], default: 'ease-in-out' },
    { id: 'sceneDuration', label: 'Scene Duration (s)', type: 'number', default: 5, min: 1, max: 60 },
    { id: 'usePerScene', label: 'Use Per-Scene Durations', type: 'boolean', default: false },
    { id: 'direction', label: 'Direction', type: 'enum', options: ['auto', 'alternate', 'random'], default: 'auto' },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const scenes = (ctx.inputs.scenes as any[]) || [];
    const sceneDurations = (ctx.inputs.sceneDurations as number[]) || [];
    const transType = (ctx.parameters.transitionType as TransitionType) || 'fade';
    const duration = (ctx.parameters.duration as number) || 1;
    const easing = (ctx.parameters.easing as string) || 'ease-in-out';
    const sceneDur = (ctx.parameters.sceneDuration as number) || 5;
    const usePerScene = ctx.parameters.usePerScene === true;
    const direction = (ctx.parameters.direction as string) || 'auto';

    if (scenes.length === 0) {
      return { outputs: { timeline: null, transitionConfig: null }, metadata: { sceneCount: 0 } };
    }

    // Build timeline
    const timelineScenes: TransitionTimeline['scenes'] = [];
    const transitions: TransitionTimeline['transitions'] = [];
    let currentTime = 0;

    for (let i = 0; i < scenes.length; i++) {
      const sd = usePerScene && i < sceneDurations.length ? sceneDurations[i] : sceneDur;
      const sceneId = scenes[i].id || `scene-${i}`;

      timelineScenes.push({
        id: sceneId,
        startTime: currentTime,
        endTime: currentTime + sd,
      });

      currentTime += sd;

      // Add transition between scenes (not after last)
      if (i < scenes.length - 1) {
        let actualType = transType;

        // Direction variants
        if (transType === 'wipe-left' || transType === 'slide-left') {
          if (direction === 'alternate') {
            actualType = i % 2 === 0 ? 'wipe-left' : 'wipe-right';
          } else if (direction === 'random') {
            const dirs = ['wipe-left', 'wipe-right', 'wipe-up', 'wipe-down'];
            actualType = dirs[Math.floor(Math.random() * dirs.length)] as TransitionType;
          }
        }

        transitions.push({
          type: actualType,
          duration,
          easing,
          fromScene: sceneId,
          toScene: scenes[i + 1]?.id || `scene-${i + 1}`,
          params: getTransitionParams(actualType),
          atTime: currentTime,
        });

        currentTime += duration; // transition time
      }
    }

    // If transitions overlap with scene end, adjust (transitions happen between scenes)
    const timeline: TransitionTimeline = {
      scenes: timelineScenes,
      transitions,
      totalDuration: currentTime,
    };

    const config: TransitionConfig = {
      type: transType, duration, easing,
      fromScene: scenes[0]?.id || 'scene-0',
      toScene: scenes[1]?.id || 'scene-1',
      params: getTransitionParams(transType),
    };

    ctx.onProgress?.(100, `Timeline: ${scenes.length} scenes, ${transitions.length} transitions, ${timeline.totalDuration.toFixed(1)}s total`);

    return {
      outputs: { timeline, transitionConfig: config },
      metadata: {
        sceneCount: scenes.length,
        transitionCount: transitions.length,
        totalDuration: timeline.totalDuration,
        transitionType: transType,
        direction,
      },
    };
  },
};

function getTransitionParams(type: TransitionType): Record<string, number> {
  switch (type) {
    case 'fade': return { opacity: 1 };
    case 'dissolve': return { blur: 5, opacity: 1 };
    case 'wipe-left': case 'wipe-right': case 'wipe-up': case 'wipe-down': return { progress: 1 };
    case 'slide-left': case 'slide-right': return { offset: 100 };
    case 'zoom-in': return { scale: 1.2 };
    case 'zoom-out': return { scale: 0.8 };
    case 'crossfade': return { opacityOverlap: 0.5 };
    case 'glitch': return { intensity: 0.3, rgbShift: 10 };
  }
}

export function generateTransitionCSS(config: TransitionConfig): string {
  const { type, duration, easing } = config;
  const base = `transition: all ${duration}s ${easing};`;

  switch (type) {
    case 'fade':
    case 'crossfade':
      return `${base} opacity ${duration}s ${easing};`;
    case 'dissolve':
      return `${base} opacity ${duration}s ${easing}, filter ${duration}s ${easing}; filter: blur(5px); opacity: 0;`;
    case 'wipe-left':
      return `${base} clip-path: inset(0 0 0 100%);`;
    case 'wipe-right':
      return `${base} clip-path: inset(0 100% 0 0);`;
    case 'wipe-up':
      return `${base} clip-path: inset(100% 0 0 0);`;
    case 'wipe-down':
      return `${base} clip-path: inset(0 0 100% 0);`;
    case 'slide-left':
      return `${base} transform: translateX(100%);`;
    case 'slide-right':
      return `${base} transform: translateX(-100%);`;
    case 'zoom-in':
      return `${base} transform: scale(1.2); opacity: 0;`;
    case 'zoom-out':
      return `${base} transform: scale(0.8); opacity: 0;`;
    case 'glitch':
      return `animation: glitch ${duration}s ${easing};`;
    default:
      return base;
  }
}
