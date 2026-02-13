export const WORKSPACE_ROOT_PATHS = {
  root: '/',
  imports: '/imports',
  library: '/library',
  projects: '/projects',
  prompts: '/prompts',
} as const;

export const WORKSPACE_ROOT_NAMES = {
  imports: 'Imports',
  library: 'Library',
  projects: 'Projects',
  prompts: 'Prompts',
  generated: 'Generated',
  exports: 'Exports',
} as const;

export const WORKSPACE_DEFAULTS = {
  projectName: 'Untitled Project',
} as const;

export const WORKSPACE_PROTECTED_PATHS = new Set<string>([
  WORKSPACE_ROOT_PATHS.root,
  WORKSPACE_ROOT_PATHS.imports,
  WORKSPACE_ROOT_PATHS.library,
  WORKSPACE_ROOT_PATHS.projects,
  WORKSPACE_ROOT_PATHS.prompts,
]);

export const STORAGE_KEYS = {
  settings: 'ars-technicai-settings',
  log: 'ars-technicai-log',
  files: 'ars-technicai-files',
  user: 'ars-technicai-user',
  projects: 'ars-technicai-projects',
  modules: 'ars-technicai-modules',
  techniques: 'ars-technicai-techniques',
  profile: 'ars-technicai-profile',
  agents: 'ars-technicai-agents',
  social: 'ars-technicai-social',
  canvasStates: 'ars-technicai-canvas-states',
  workspaceWipeFlag: 'ars-technicai-workspace-wiped-v1',
} as const;

export const WORKSPACE_DATA_KEYS_TO_CLEAR = [
  STORAGE_KEYS.files,
  STORAGE_KEYS.user,
  STORAGE_KEYS.projects,
  STORAGE_KEYS.modules,
  STORAGE_KEYS.techniques,
  STORAGE_KEYS.profile,
  STORAGE_KEYS.agents,
  STORAGE_KEYS.social,
  STORAGE_KEYS.log,
  STORAGE_KEYS.canvasStates,
] as const;
