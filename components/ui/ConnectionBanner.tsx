/**
 * ConnectionBanner
 *
 * Displays connection status to the home server and APIs at app startup.
 * - Green: all services connected (ephemeral, auto-dismisses quickly)
 * - Orange: degraded (partial connectivity)
 * - Red: error (cannot connect)
 * Includes X button to dismiss manually.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import type { HealthResponse } from '@/pages/api/health';
import styles from './ConnectionBanner.module.css';

const EPHEMERAL_DELAY_MS = 3000; // Green banner auto-dismisses after 3s
const HEALTH_REQUEST_TIMEOUT_MS = 6000;
const HEALTH_RETRY_DELAY_MS = 1200;

export const ConnectionBanner: React.FC = () => {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    let lastErrorMessage = 'Request failed';

    const runHealthRequest = async (): Promise<HealthResponse> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch('/api/health', { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return (await res.json()) as HealthResponse;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    try {
      let json: HealthResponse | null = null;
      try {
        json = await runHealthRequest();
      } catch (firstError) {
        lastErrorMessage =
          firstError instanceof Error ? firstError.message : 'Request failed';
        await new Promise((resolve) => setTimeout(resolve, HEALTH_RETRY_DELAY_MS));
        json = await runHealthRequest();
      }
      setData(json);
      const { useTelemetryStore } = await import('@/stores/telemetryStore');
      useTelemetryStore.getState().setHealth({
        status: json.status,
        services: json.services ?? [],
        checkedAt: json.timestamp ?? Date.now(),
      });
    } catch (error) {
      lastErrorMessage =
        error instanceof Error ? error.message : lastErrorMessage;
      setData({
        status: 'degraded',
        services: [
          { name: 'Health check', status: 'degraded', message: `Health endpoint unavailable: ${lastErrorMessage}` },
        ],
        timestamp: Date.now(),
      });
      const { useTelemetryStore } = await import('@/stores/telemetryStore');
      useTelemetryStore.getState().setHealth({
        status: 'degraded',
        services: [{ name: 'Health check', status: 'degraded', message: `Health endpoint unavailable: ${lastErrorMessage}` }],
        checkedAt: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Ephemeral: when green (ok), auto-dismiss after delay
  useEffect(() => {
    if (!data || data.status !== 'ok' || dismissed || loading) return;

    const t = setTimeout(() => setDismissed(true), EPHEMERAL_DELAY_MS);
    return () => clearTimeout(t);
  }, [data, dismissed, loading]);

  if (loading || !data || dismissed) return null;

  const statusClass =
    data.status === 'ok'
      ? styles.connectionBannerStatusVariantOk
      : data.status === 'degraded'
        ? styles.connectionBannerStatusVariantDegraded
        : styles.connectionBannerStatusVariantError;

  const Icon =
    data.status === 'ok'
      ? CheckCircle
      : data.status === 'degraded'
        ? AlertTriangle
        : AlertCircle;

  const statusLabel =
    data.status === 'ok'
      ? 'Connected'
      : data.status === 'degraded'
        ? 'Degraded'
        : 'Connection error';

  return (
    <div
      id="connection-banner-status-at-startup"
      className={`${styles.connectionBannerStatusRootAtStartup} ${statusClass}`}
      role="status"
      aria-live="polite"
    >
      <div className={styles.connectionBannerStatusContentRegion}>
        <Icon size={18} className={styles.connectionBannerStatusIconByState} />
        <div className={styles.connectionBannerStatusTextRegion}>
          <span className={styles.connectionBannerStatusLabelPrimary}>{statusLabel}</span>
          {data.services
            .filter((s) => s.status === 'ok')
            .map((s) => (
              <span key={s.name} className={styles.connectionBannerServiceStatusOk}>
                {s.name}
              </span>
            ))}
          {data.services
            .filter((s) => s.status !== 'ok')
            .map((s) => (
              <div key={s.name} className={styles.connectionBannerServiceStatusNotOk}>
                <span className={styles.connectionBannerServiceStatusBold}>{s.name}:</span>{' '}
                <span className={styles.connectionBannerServiceStatusNormal}>{s.message || s.status}</span>
              </div>
            ))}
        </div>
      </div>
      <button
        type="button"
        className={styles.connectionBannerDismissButtonByUser}
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
};
