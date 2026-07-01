// ============================================================
// ARS TECHNICAI — Location Library Module (ART-016)
// Manage recurring locations across a story.
// Consistency: same location looks the same in every scene.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'intel.location.library';

export interface LocationProfile {
  id: string;
  name: string;
  type: 'INT' | 'EXT' | 'INT/EXT';
  description: string;
  timeOfDay: string;
  weather: string;
  season: string;
  lighting: string;
  atmosphere: string;
  props: string[];
  referenceImages: string[];
  appearanceCount: number;
  firstScene: number;
  lastScene: number;
  consistencyScore: number;
  promptTemplate: string;
}

export interface LocationLibrary {
  locations: LocationProfile[];
  totalAppearances: number;
  mostUsed: LocationProfile | null;
  consistencyWarnings: string[];
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Location Library',
  category: 'intelligence',
  description: 'Manage recurring locations across a story. Each location has a canonical description, reference images, and a prompt template. Ensures the same location looks consistent in every scene where it appears. Tracks transitions (time of day, weather, damage).',
  inputs: [
    { id: 'locations', label: 'Location Profiles', type: 'data', direction: 'input', optional: true },
    { id: 'sceneReferences', label: 'Scene References', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'library', label: 'Location Library', type: 'data', direction: 'output' },
    { id: 'locationPrompt', label: 'Location Prompt', type: 'text', direction: 'output' },
    { id: 'consistencyReport', label: 'Consistency Report', type: 'text', direction: 'output' },
  ],
  parameters: [
    { id: 'locationName', label: 'Location Name', type: 'string', default: '' },
    { id: 'locationType', label: 'Type', type: 'enum', options: ['INT', 'EXT', 'INT/EXT'], default: 'INT' },
    { id: 'timeOfDay', label: 'Time of Day', type: 'enum', options: ['dawn', 'morning', 'midday', 'afternoon', 'golden-hour', 'sunset', 'blue-hour', 'night', 'midnight'], default: 'midday' },
    { id: 'weather', label: 'Weather', type: 'enum', options: ['clear', 'cloudy', 'rain', 'fog', 'snow', 'storm', 'windy', 'hazy'], default: 'clear' },
    { id: 'season', label: 'Season', type: 'enum', options: ['spring', 'summer', 'autumn', 'winter'], default: 'spring' },
    { id: 'lighting', label: 'Lighting', type: 'string', default: 'natural daylight' },
    { id: 'atmosphere', label: 'Atmosphere', type: 'string', default: '' },
    { id: 'description', label: 'Description', type: 'string', default: '' },
    { id: 'action', label: 'Action', type: 'enum', options: ['register', 'get-prompt', 'list', 'check-consistency'], default: 'get-prompt' },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const action = (ctx.parameters.action as string) || 'get-prompt';
    const locations = (ctx.inputs.locations as LocationProfile[]) || [];
    const name = (ctx.parameters.locationName as string) || '';

    if (action === 'get-prompt') {
      if (!name && locations.length === 0) {
        return { outputs: { library: null, locationPrompt: 'No location specified.', consistencyReport: '' } };
      }

      const loc = locations.find(l => l.name === name) || buildLocationFromParams(ctx.parameters);
      const prompt = loc?.promptTemplate || buildPromptFromParams(ctx.parameters);

      return {
        outputs: { locationPrompt: prompt, library: { locations, totalAppearances: 0, mostUsed: null, consistencyWarnings: [] }, consistencyReport: '' },
        metadata: { locationName: name || 'custom' },
      };
    }

    if (action === 'list') {
      const sorted = [...locations].sort((a, b) => b.appearanceCount - a.appearanceCount);
      const lib: LocationLibrary = {
        locations: sorted,
        totalAppearances: sorted.reduce((s, l) => s + l.appearanceCount, 0),
        mostUsed: sorted[0] || null,
        consistencyWarnings: sorted.filter(l => l.consistencyScore < 0.7).map(l =>
          `"${l.name}" has low consistency (${(l.consistencyScore * 100).toFixed(0)}%). Consider updating reference images.`
        ),
      };
      return { outputs: { library: lib, locationPrompt: '', consistencyReport: lib.consistencyWarnings.join('\n') } };
    }

    if (action === 'check-consistency') {
      const warnings = locations.filter(l => l.consistencyScore < 0.7)
        .map(l => `"${l.name}": score ${(l.consistencyScore * 100).toFixed(0)}%, ${l.appearanceCount} appearances across scenes ${l.firstScene}-${l.lastScene}`);
      return {
        outputs: {
          library: { locations, totalAppearances: 0, mostUsed: null, consistencyWarnings: warnings },
          consistencyReport: warnings.length > 0
            ? `${warnings.length} location(s) need consistency review:\n${warnings.join('\n')}`
            : 'All locations have good consistency scores.',
        },
      };
    }

    return { outputs: { library: null, locationPrompt: '', consistencyReport: `Unknown action: ${action}` } };
  },
};

function buildLocationFromParams(params: Record<string, unknown>): LocationProfile {
  const desc = (params.description as string) || '';
  return {
    id: 'custom',
    name: (params.locationName as string) || 'Unnamed Location',
    type: (params.locationType as LocationProfile['type']) || 'INT',
    description: desc,
    timeOfDay: (params.timeOfDay as string) || 'midday',
    weather: (params.weather as string) || 'clear',
    season: (params.season as string) || 'spring',
    lighting: (params.lighting as string) || 'natural daylight',
    atmosphere: (params.atmosphere as string) || '',
    props: [],
    referenceImages: [],
    appearanceCount: 0,
    firstScene: 0,
    lastScene: 0,
    consistencyScore: 1,
    promptTemplate: buildPromptFromParams(params),
  };
}

function buildPromptFromParams(params: Record<string, unknown>): string {
  const parts: string[] = [];
  const name = (params.locationName as string) || '';
  const type = (params.locationType as string) || 'INT';
  const desc = (params.description as string) || '';
  const tod = (params.timeOfDay as string) || 'midday';
  const weather = (params.weather as string) || 'clear';
  const season = (params.season as string) || 'spring';
  const lighting = (params.lighting as string) || '';
  const atmosphere = (params.atmosphere as string) || '';

  if (name) parts.push(name);
  parts.push(`${type} location`);
  if (desc) parts.push(desc);
  parts.push(`${tod}, ${weather} weather, ${season}`);
  if (lighting) parts.push(`${lighting} lighting`);
  if (atmosphere) parts.push(`${atmosphere} atmosphere`);
  parts.push('cinematic establishing shot, 8K, ultra-detailed');

  return parts.filter(Boolean).join('. ');
}
