// ============================================================
// ARS TECHNICAI — Module System Types
// Phase 0.1: Module registry with typed ports and execution context
// ============================================================

import type { UUID } from './index';

export type PortType =
  | 'image'
  | 'video'
  | 'audio'
  | '3d'
  | 'text'
  | 'data'
  | 'mask'
  | 'number';

export type ModuleCategory =
  | 'ingest'
  | 'generate'
  | 'edit'
  | 'spatial'
  | 'intelligence'
  | 'assembly'
  | 'publish';

export interface ModulePort {
  id: string;
  label: string;
  type: PortType;
  direction: 'input' | 'output';
  optional?: boolean;
}

export interface ModuleParameter {
  id: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'color' | 'rect' | 'size' | 'json';
  default?: unknown;
  options?: string[]; // for enum
  min?: number;
  max?: number;
  step?: number;
}

export interface ModuleDef {
  id: string;
  name: string;
  category: ModuleCategory;
  description?: string;
  inputs: ModulePort[];
  outputs: ModulePort[];
  parameters: ModuleParameter[];
  execute: (ctx: ModuleContext) => Promise<ModuleResult> | ModuleResult;
}

export interface ModuleContext {
  inputs: Record<string, unknown>;
  parameters: Record<string, unknown>;
  projectId?: string;
  userId?: string;
  signal?: AbortSignal;
  // Progress callback for long-running modules
  onProgress?: (progress: number, message?: string) => void;
}

export interface ModuleResult {
  outputs: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface ModuleRegistry {
  get(id: string): ModuleDef | undefined;
  list(): ModuleDef[];
  listByCategory(category: ModuleCategory): ModuleDef[];
  register(def: ModuleDef): void;
  unregister(id: string): void;
}
