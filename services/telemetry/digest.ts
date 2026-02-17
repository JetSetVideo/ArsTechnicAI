/**
 * Telemetry Digest — Derive metrics and build telemetry snapshot
 */

import { v4 as uuidv4 } from 'uuid';
import {
  deriveDeviceTier,
  deriveConnectivityTier,
  computeClientSignature,
  type DeviceTier,
  type ConnectivityTier,
} from '@/utils/clientSignature';
import type { GatheredData } from './gather';
import type {
  TelemetrySnapshot,
  SanitizedDeviceInfo,
  HealthStatus,
  ServiceStatus,
} from '@/types/telemetry';

export function digestGatheredData(
  gathered: GatheredData,
  health: { status: HealthStatus; services: ServiceStatus[]; checkedAt: number } | null
): TelemetrySnapshot {
  const device = gathered.device;
  const deviceTier: DeviceTier = device
    ? deriveDeviceTier(device.hardwareConcurrency, device.deviceMemory)
    : 'unknown';
  const connectivityTier: ConnectivityTier = device
    ? deriveConnectivityTier(device.connectionEffectiveType)
    : 'unknown';
  const clientSignature = computeClientSignature(deviceTier, connectivityTier);

  const sanitizedDevice: SanitizedDeviceInfo = device
    ? {
        platform: device.platform,
        screenWidth: device.screenWidth,
        screenHeight: device.screenHeight,
        devicePixelRatio: device.devicePixelRatio,
        orientation: device.orientation,
        hardwareConcurrency: device.hardwareConcurrency,
        deviceMemory: device.deviceMemory,
        language: device.language,
        timezone: device.timezone,
      }
    : {
        platform: 'unknown',
        screenWidth: 0,
        screenHeight: 0,
        devicePixelRatio: 1,
        orientation: 'landscape',
        hardwareConcurrency: 1,
        deviceMemory: null,
        language: 'en',
        timezone: 'UTC',
      };

  const now = Date.now();
  const sessionDurationMs = now - gathered.sessionStartedAt;

  return {
    id: uuidv4(),
    timestamp: now,
    clientSignature,
    device: sanitizedDevice,
    storage: gathered.storage,
    features: gathered.features,
    sessionId: gathered.sessionId,
    sessionStartedAt: gathered.sessionStartedAt,
    sessionDurationMs,
    usage: {
      ...gathered.usage,
      logEntriesByType: gathered.logEntriesByType,
    },
    paths: {
      currentProjectPath: gathered.currentProjectPath,
      rootFolderCount: gathered.rootFolderCount,
      assetCount: gathered.assetCount,
    },
    settingsDigest: gathered.settingsDigest,
    projects: {
      count: gathered.projectCount,
      recentCount: gathered.recentProjectCount,
    },
    deviceTier,
    connectivityTier,
    health,
  };
}
