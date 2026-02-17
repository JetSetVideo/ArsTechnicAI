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

export const ConnectionBanner: React.FC = () => {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health');
      const json: HealthResponse = await res.json();
      setData(json);
      const { useTelemetryStore } = await import('@/stores/telemetryStore');
      useTelemetryStore.getState().setHealth({
        status: json.status,
        services: json.services ?? [],
        checkedAt: json.timestamp ?? Date.now(),
      });
    } catch {
      setData({
        status: 'error',
        services: [
          { name: 'Health check', status: 'error', message: 'Request failed' },
        ],
        timestamp: Date.now(),
      });
      const { useTelemetryStore } = await import('@/stores/telemetryStore');
      useTelemetryStore.getState().setHealth({
        status: 'error',
        services: [{ name: 'Health check', status: 'error', message: 'Request failed' }],
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
      ? styles.statusOk
      : data.status === 'degraded'
        ? styles.statusDegraded
        : styles.statusError;

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
    <div className={`${styles.banner} ${statusClass}`} role="status" aria-live="polite">
      <div className={styles.content}>
        <Icon size={18} className={styles.icon} />
        <div className={styles.text}>
          <span className={styles.label}>{statusLabel}</span>
          {data.services
            .filter((s) => s.status === 'ok')
            .map((s) => (
              <span key={s.name} className={styles.serviceOk}>
                {s.name}
              </span>
            ))}
          {data.services
            .filter((s) => s.status !== 'ok')
            .map((s) => (
              <span key={s.name} className={styles.serviceFail}>
                {s.name}: {s.message || s.status}
              </span>
            ))}
        </div>
      </div>
      <button
        type="button"
        className={styles.closeButton}
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
};
