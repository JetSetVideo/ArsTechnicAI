// ============================================================
// ARS TECHNICAI — States & Variables Engine
// Tracks similarity and opposition between assets/states.
// Computes relationships: similar, opposite, dependent,
// transforms variables across states, builds transition maps.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'intel.states.variables';

// ─── Types ─────────────────────────────────────────────────────────────

export interface StateVariable {
  id: string;
  name: string;
  value: number;           // normalized 0-1
  category: string;        // color, position, scale, opacity, speed, mood, etc.
  unit: string;            // px, %, deg, s, etc.
  min: number;
  max: number;
  current: number;
}

export interface StateRelation {
  fromId: string;
  toId: string;
  type: 'similar' | 'opposite' | 'dependent' | 'independent' | 'proportional' | 'inverse';
  strength: number;        // 0-1 how strong the relationship is
  transform: (value: number) => number;
}

export interface StateMap {
  variables: StateVariable[];
  relations: StateRelation[];
  clusters: StateCluster[];
  transitionPaths: TransitionPath[];
}

export interface StateCluster {
  id: string;
  variableIds: string[];
  label: string;
  centroid: number;        // average normalized value
  similarityScore: number; // internal cluster cohesion 0-1
}

export interface TransitionPath {
  fromState: string;
  toState: string;
  steps: StateVariable[][];  // intermediate states
  totalDistance: number;     // total change across all variables
  duration: number;          // estimated transition time
}

// ─── Similarity / Opposition Engine ────────────────────────────────────

export function computeRelations(variables: StateVariable[]): StateRelation[] {
  const relations: StateRelation[] = [];

  for (let i = 0; i < variables.length; i++) {
    for (let j = i + 1; j < variables.length; j++) {
      const a = variables[i];
      const b = variables[j];

      // Only compare variables in same category or related categories
      if (!areRelatedCategories(a.category, b.category)) continue;

      const aNorm = normalizeVar(a);
      const bNorm = normalizeVar(b);
      const diff = Math.abs(aNorm - bNorm);

      if (diff < 0.15 && a.category === b.category) {
        // Very similar values in same category = similar
        relations.push({
          fromId: a.id, toId: b.id,
          type: 'similar',
          strength: 1 - diff,
          transform: (v) => v * (bNorm / Math.max(aNorm, 0.001)),
        });
      } else if (diff > 0.8 && a.category === b.category) {
        // Very different values in same category = opposite
        relations.push({
          fromId: a.id, toId: b.id,
          type: 'opposite',
          strength: diff,
          transform: (v) => 1 - v,
        });
      } else if (areCategoriesProportional(a.category, b.category)) {
        // Proportional categories (e.g., scale affects position)
        relations.push({
          fromId: a.id, toId: b.id,
          type: 'proportional',
          strength: 0.5,
          transform: (v) => v * 0.5 + bNorm * 0.5,
        });
      } else if (areCategoriesInverse(a.category, b.category)) {
        // Inverse categories (e.g., speed vs duration)
        relations.push({
          fromId: a.id, toId: b.id,
          type: 'inverse',
          strength: 0.7,
          transform: (v) => 1 - v,
        });
      }
    }
  }

  return relations;
}

export function clusterVariables(variables: StateVariable[]): StateCluster[] {
  const clusters: StateCluster[] = [];
  const byCategory = new Map<string, StateVariable[]>();

  for (const v of variables) {
    if (!byCategory.has(v.category)) byCategory.set(v.category, []);
    byCategory.get(v.category)!.push(v);
  }

  for (const [category, vars] of byCategory) {
    const values = vars.map(v => normalizeVar(v));
    const centroid = values.reduce((s, v) => s + v, 0) / values.length;
    const maxDiff = Math.max(...values) - Math.min(...values);
    const similarity = 1 - maxDiff; // tighter cluster = higher similarity

    clusters.push({
      id: `cluster-${category}`,
      variableIds: vars.map(v => v.id),
      label: category,
      centroid,
      similarityScore: Math.max(0, similarity),
    });
  }

  return clusters;
}

export function buildTransitionPaths(
  fromVars: StateVariable[],
  toVars: StateVariable[],
  steps: number = 5,
): TransitionPath {
  const interpolated: StateVariable[][] = [];

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const stepVars: StateVariable[] = fromVars.map((from, i) => {
      const to = toVars[i] || from;
      const eased = easeInOutCubic(t);
      return {
        ...from,
        current: from.current + (to.current - from.current) * eased,
        value: from.value + (to.value - from.value) * eased,
      };
    });
    interpolated.push(stepVars);
  }

  const totalDistance = fromVars.reduce((sum, from, i) => {
    const to = toVars[i] || from;
    return sum + Math.abs(normalizeVar(to) - normalizeVar(from));
  }, 0);

  return {
    fromState: 'state-a',
    toState: 'state-b',
    steps: interpolated,
    totalDistance,
    duration: totalDistance * 2, // approximate: 2s per unit distance
  };
}

// ─── Category Relations ────────────────────────────────────────────────

const RELATED_CATEGORIES: Record<string, string[]> = {
  position: ['scale', 'depth'],
  scale: ['position', 'depth'],
  depth: ['position', 'scale'],
  color: ['opacity', 'mood'],
  opacity: ['color', 'speed'],
  speed: ['duration', 'opacity'],
  duration: ['speed'],
  mood: ['color', 'intensity'],
  rotation: ['position'],
};

function areRelatedCategories(a: string, b: string): boolean {
  if (a === b) return true;
  return RELATED_CATEGORIES[a]?.includes(b) || RELATED_CATEGORIES[b]?.includes(a) || false;
}

const PROPORTIONAL_PAIRS = new Set(['scale,position', 'speed,duration', 'opacity,color', 'intensity,mood']);
const INVERSE_PAIRS = new Set(['speed,duration', 'scale,depth']);

function areCategoriesProportional(a: string, b: string): boolean {
  return PROPORTIONAL_PAIRS.has(`${a},${b}`) || PROPORTIONAL_PAIRS.has(`${b},${a}`);
}

function areCategoriesInverse(a: string, b: string): boolean {
  return INVERSE_PAIRS.has(`${a},${b}`) || INVERSE_PAIRS.has(`${b},${a}`);
}

function normalizeVar(v: StateVariable): number {
  if (v.max === v.min) return 0.5;
  return Math.max(0, Math.min(1, (v.current - v.min) / (v.max - v.min)));
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ─── Module ─────────────────────────────────────────────────────────────

export const CATEGORIES = ['color', 'position', 'scale', 'opacity', 'speed', 'mood', 'duration', 'depth', 'rotation', 'intensity', 'blur', 'volume'];

export const moduleDef: ModuleDef = {
  id,
  name: 'States & Variables',
  category: 'intelligence',
  description: 'Track relationships between asset states and variables. Compute similarity (close values in same category) and opposition (far values). Cluster variables by category. Build transition paths with interpolated intermediate states. Supports 12 variable categories with relational mapping.',
  inputs: [
    { id: 'variables', label: 'State Variables', type: 'data', direction: 'input', optional: true },
    { id: 'fromState', label: 'From State', type: 'data', direction: 'input', optional: true },
    { id: 'toState', label: 'To State', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'relations', label: 'Variable Relations', type: 'data', direction: 'output' },
    { id: 'clusters', label: 'Variable Clusters', type: 'data', direction: 'output' },
    { id: 'transitionPath', label: 'Transition Path', type: 'data', direction: 'output' },
    { id: 'stateMap', label: 'Full State Map', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'action', label: 'Action', type: 'enum', options: ['analyze', 'cluster', 'transition', 'full'], default: 'analyze' },
    { id: 'transitionSteps', label: 'Transition Steps', type: 'number', default: 5, min: 2, max: 20 },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const action = (ctx.parameters.action as string) || 'analyze';
    const variables = (ctx.inputs.variables as StateVariable[]) || [];
    const fromState = (ctx.inputs.fromState as StateVariable[]) || [];
    const toState = (ctx.inputs.toState as StateVariable[]) || [];

    if (variables.length === 0 && fromState.length === 0) {
      // Generate sample variables for demonstration
      const sampleVars = generateSampleVariables();
      const relations = computeRelations(sampleVars);
      const clusters = clusterVariables(sampleVars);

      return {
        outputs: {
          relations,
          clusters,
          transitionPath: null,
          stateMap: { variables: sampleVars, relations, clusters, transitionPaths: [] },
        },
        metadata: { variableCount: sampleVars.length, relationCount: relations.length, clusterCount: clusters.length },
      };
    }

    let relations: StateRelation[] = [];
    let clusters: StateCluster[] = [];
    let transitionPath: TransitionPath | null = null;

    if (action === 'analyze' || action === 'full') {
      relations = computeRelations(variables);
    }
    if (action === 'cluster' || action === 'full') {
      clusters = clusterVariables(variables);
    }
    if (action === 'transition' || action === 'full') {
      if (fromState.length > 0 && toState.length > 0) {
        transitionPath = buildTransitionPaths(fromState, toState, (ctx.parameters.transitionSteps as number) || 5);
      }
    }

    const stateMap: StateMap = { variables, relations, clusters, transitionPaths: transitionPath ? [transitionPath] : [] };

    return {
      outputs: { relations, clusters, transitionPath, stateMap },
      metadata: {
        variableCount: variables.length,
        relationCount: relations.length,
        clusterCount: clusters.length,
        similarCount: relations.filter(r => r.type === 'similar').length,
        oppositeCount: relations.filter(r => r.type === 'opposite').length,
        transitionSteps: transitionPath?.steps.length || 0,
        transitionDistance: transitionPath?.totalDistance || 0,
      },
    };
  },
};

function generateSampleVariables(): StateVariable[] {
  return [
    { id: 'v1', name: 'Position X', value: 0.5, category: 'position', unit: '%', min: 0, max: 100, current: 50 },
    { id: 'v2', name: 'Position Y', value: 0.3, category: 'position', unit: '%', min: 0, max: 100, current: 30 },
    { id: 'v3', name: 'Scale', value: 0.8, category: 'scale', unit: 'x', min: 0.1, max: 3, current: 1.5 },
    { id: 'v4', name: 'Opacity', value: 0.9, category: 'opacity', unit: '%', min: 0, max: 100, current: 90 },
    { id: 'v5', name: 'Speed', value: 0.2, category: 'speed', unit: 's', min: 0, max: 10, current: 2 },
    { id: 'v6', name: 'Duration', value: 0.5, category: 'duration', unit: 's', min: 0, max: 60, current: 30 },
    { id: 'v7', name: 'Blur Radius', value: 0.1, category: 'blur', unit: 'px', min: 0, max: 50, current: 5 },
    { id: 'v8', name: 'Rotation', value: 0.25, category: 'rotation', unit: 'deg', min: 0, max: 360, current: 90 },
    { id: 'v9', name: 'Mood Intensity', value: 0.7, category: 'intensity', unit: '%', min: 0, max: 100, current: 70 },
    { id: 'v10', name: 'Volume', value: 0.6, category: 'volume', unit: '%', min: 0, max: 100, current: 60 },
  ];
}
