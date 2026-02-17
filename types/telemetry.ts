/**
 * Telemetry Types — Health, Error, and Analytics
 */

import type { ActionType } from './index';

export type HealthStatus = 'ok' | 'degraded' | 'error';

export interface ServiceStatus {
  name: string;
  status: HealthStatus;
  message?: string;
}

export interface SanitizedDeviceInfo {
  platform: string;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  orientation: string;
  hardwareConcurrency: number;
  deviceMemory: number | null;
  language: string;
  timezone: string;
}

export interface TelemetrySnapshot {
  id: string;
  timestamp: number;
  clientSignature: string;

  device: SanitizedDeviceInfo;
  storage: { quota: number; usage: number; usagePercent: number } | null;
  features: Record<string, boolean>;

  sessionId: string;
  sessionStartedAt: number;
  sessionDurationMs: number;

  usage: {
    generations: number;
    imports: number;
    exports: number;
    projectsOpened: number;
    canvasItems: number;
    logEntriesByType: Partial<Record<ActionType, number>>;
  };

  paths: {
    currentProjectPath: string;
    rootFolderCount: number;
    assetCount: number;
  };

  settingsDigest: {
    provider: string;
    fontSize: string;
    compactMode: boolean;
    showGrid: boolean;
  };

  projects: { count: number; recentCount: number };

  deviceTier: 'low' | 'medium' | 'high' | 'unknown';
  connectivityTier: 'slow' | '3g' | '4g' | 'unknown';

  health: { status: HealthStatus; services: ServiceStatus[]; checkedAt: number } | null;
}

export interface ErrorEvent {
  id: string;
  timestamp: number;
  code: string;
  message: string;
  clientSignature: string;
  context?: Record<string, unknown>;
  synced: boolean;
}

export interface TelemetryPayload {
  sessionId: string;
  clientSignature: string;
  device: SanitizedDeviceInfo & { deviceTier: string; connectivityTier: string };
  session: { startedAt: number; durationMs: number };
  usage: TelemetrySnapshot['usage'];
  paths: TelemetrySnapshot['paths'];
  settingsDigest: TelemetrySnapshot['settingsDigest'];
  projects: TelemetrySnapshot['projects'];
  health: TelemetrySnapshot['health'];
  storage: TelemetrySnapshot['storage'];
  features: TelemetrySnapshot['features'];
  appVersion: string;
}
