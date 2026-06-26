// ============================================================
// ARS TECHNICAI — Project Bundle Spec
// Phase 0.4: .arsproj/ manifest read/write
// ============================================================

import type { CanvasItem, CanvasViewport, UUID } from '@/types';
import type { Blueprint } from '@/types/blueprint';

export interface ProjectBundleManifest {
  version: string;
  appVersion: string;
  projectId: UUID;
  projectName: string;
  projectType: string;
  aspectRatio: string;
  createdAt: string;
  updatedAt: string;
  checksums: Record<string, string>;
}

export interface ProjectBundle {
  manifest: ProjectBundleManifest;
  canvas: {
    viewport: CanvasViewport;
    items: CanvasItem[];
  };
  timeline: Record<string, unknown>;
  graph: Record<string, unknown>;
  production: Record<string, unknown>;
  assets: {
    index: Record<string, unknown>;
  };
  blueprints: Blueprint[];
  automations: Record<string, unknown>[];
}

const BUNDLE_VERSION = '1.0.0';

export function createBundle(
  projectId: string,
  projectName: string,
  opts: {
    projectType?: string;
    aspectRatio?: string;
    canvasItems?: CanvasItem[];
    canvasViewport?: CanvasViewport;
    blueprints?: Blueprint[];
    appVersion?: string;
  } = {}
): ProjectBundle {
  const now = new Date().toISOString();
  return {
    manifest: {
      version: BUNDLE_VERSION,
      appVersion: opts.appVersion || '1.0.0',
      projectId,
      projectName,
      projectType: opts.projectType || 'short',
      aspectRatio: opts.aspectRatio || '16:9',
      createdAt: now,
      updatedAt: now,
      checksums: {},
    },
    canvas: {
      viewport: opts.canvasViewport || { x: 0, y: 0, zoom: 1 },
      items: opts.canvasItems || [],
    },
    timeline: {},
    graph: {},
    production: {},
    assets: { index: {} },
    blueprints: opts.blueprints || [],
    automations: [],
  };
}

export function bundleToJson(bundle: ProjectBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function parseBundleJson(json: string): ProjectBundle {
  const parsed = JSON.parse(json) as ProjectBundle;
  // Validate minimal structure
  if (!parsed.manifest || !parsed.manifest.projectId) {
    throw new Error('Invalid bundle: missing manifest or projectId');
  }
  if (!parsed.canvas) {
    parsed.canvas = { viewport: { x: 0, y: 0, zoom: 1 }, items: [] };
  }
  if (!parsed.blueprints) {
    parsed.blueprints = [];
  }
  if (!parsed.automations) {
    parsed.automations = [];
  }
  return parsed;
}

export function updateBundleChecksums(bundle: ProjectBundle): ProjectBundle {
  // Simple checksum using JSON.stringify length + hash of content
  const checksums: Record<string, string> = {};
  const sections = ['canvas', 'timeline', 'graph', 'production', 'assets', 'blueprints', 'automations'] as const;
  for (const section of sections) {
    const data = bundle[section];
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    checksums[section] = Math.abs(hash).toString(16).padStart(8, '0');
  }
  return {
    ...bundle,
    manifest: {
      ...bundle.manifest,
      updatedAt: new Date().toISOString(),
      checksums,
    },
  };
}

export function verifyBundleChecksums(bundle: ProjectBundle): boolean {
  const fresh = updateBundleChecksums(bundle);
  const original = bundle.manifest.checksums;
  const computed = fresh.manifest.checksums;
  for (const key of Object.keys(original)) {
    if (original[key] !== computed[key]) return false;
  }
  return true;
}
