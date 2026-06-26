// ============================================================
// ARS TECHNICAI — Blueprint Types
// Phase 0.5: Blueprint types and store
// ============================================================

import type { UUID } from './index';

export type BlueprintCategory =
  | 'image'
  | 'video'
  | 'audio'
  | '3d'
  | 'social'
  | 'full-pipeline';

export interface BlueprintParameter {
  id: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'asset' | 'prompt';
  default?: unknown;
  options?: string[];
  required?: boolean;
  description?: string;
}

export interface BlueprintNode {
  id: string;
  moduleId: string;
  x: number;
  y: number;
  parameters: Record<string, unknown>;
}

export interface BlueprintConnection {
  id: string;
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
}

export interface Blueprint {
  id: UUID;
  name: string;
  description?: string;
  category: BlueprintCategory;
  nodes: BlueprintNode[];
  connections: BlueprintConnection[];
  parameters: BlueprintParameter[];
  version: string;
  createdAt: number;
  updatedAt: number;
  userId?: string;
  isPublic?: boolean;
}

export interface BlueprintRun {
  id: UUID;
  blueprintId: UUID;
  status: 'queued' | 'running' | 'completed' | 'failed';
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}
