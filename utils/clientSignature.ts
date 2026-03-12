/**
 * Client Version Signature — Offline-unique code for bug/performance tracking
 *
 * Deterministic hash of: app version, build ID, device tier, connectivity tier, feature hash.
 * Works fully offline. No PII.
 */

export type DeviceTier = 'low' | 'medium' | 'high' | 'unknown';
export type ConnectivityTier = 'slow' | '3g' | '4g' | 'unknown';

export const APP_VERSION =
  (typeof process !== 'undefined' && (process as NodeJS.Process & { env?: Record<string, string> }).env?.NEXT_PUBLIC_APP_VERSION) ||
  '1.0.0';

/** Simple djb2 hash — sync, fast, works offline */
function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return h >>> 0;
}

/** Convert number to short alphanumeric (base36, 6 chars) */
function toShortCode(n: number): string {
  return Math.abs(n).toString(36).slice(0, 6).padStart(6, '0');
}

/**
 * Derive device tier from hardware capabilities.
 * High: 8+ GB RAM and 4+ cores (or unknown memory with 4+ cores)
 * Medium: 4+ GB or 2+ cores
 * Low: else
 */
export function deriveDeviceTier(
  hardwareConcurrency: number,
  deviceMemory: number | null
): DeviceTier {
  const cores = hardwareConcurrency || 1;
  const mem = deviceMemory ?? 0;
  if (mem >= 8 && cores >= 4) return 'high';
  if (mem >= 4 || cores >= 4) return 'high';
  if (mem >= 2 || cores >= 2) return 'medium';
  return 'low';
}

/**
 * Map navigator.connection.effectiveType to tier.
 */
export function deriveConnectivityTier(effectiveType: string | null): ConnectivityTier {
  if (!effectiveType) return 'unknown';
  const t = effectiveType.toLowerCase();
  if (t === '4g' || t === '5g') return '4g';
  if (t === '3g') return '3g';
  if (t === 'slow-2g' || t === '2g') return 'slow';
  return 'unknown';
}

/**
 * Gather feature flags (WebGL, Workers, IndexedDB, etc.)
 */
export function gatherFeatureFlags(): Record<string, boolean> {
  if (typeof window === 'undefined') {
    return { webgl: false, workers: false, indexedDB: false, serviceWorker: false };
  }
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  return {
    webgl: !!gl,
    workers: typeof Worker !== 'undefined',
    indexedDB: typeof indexedDB !== 'undefined',
    serviceWorker: 'serviceWorker' in navigator,
  };
}

/**
 * Compute short hash of feature flags for signature input.
 */
function featureHash(features: Record<string, boolean>): string {
  const str = Object.entries(features)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
  return toShortCode(djb2(str));
}

/**
 * Get Next.js build ID (dev vs prod).
 */
function getBuildId(): string {
  if (typeof window === 'undefined') return 'ssr';
  const nextData = (window as unknown as { __NEXT_DATA__?: { buildId?: string } }).__NEXT_DATA__;
  return nextData?.buildId ?? 'dev';
}

/**
 * Compute client signature — offline-unique code for this version + environment.
 * Example: v1.0.0-a3f2c1
 */
export function computeClientSignature(
  deviceTier: DeviceTier,
  connectivityTier: ConnectivityTier
): string {
  const buildId = getBuildId();
  const features = gatherFeatureFlags();
  const fHash = featureHash(features);
  const input = `${APP_VERSION}-${buildId}-${deviceTier}-${connectivityTier}-${fHash}`;
  const hash = toShortCode(djb2(input));
  return `v${APP_VERSION}-${hash}`;
}
