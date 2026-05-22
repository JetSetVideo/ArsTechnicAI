/**
 * useSyncOnReconnect — flushes the offline queue whenever the server
 * transitions from unreachable to reachable.
 *
 * Mount once in _app.tsx (or AppShell) so it runs globally.
 */

import { useEffect, useRef, useCallback } from 'react';
import { flushQueue, hasPendingSync, queueSize } from '@/lib/sync/offlineQueue';
import { useTelemetryStore } from '@/stores/telemetryStore';

const FLUSH_DEBOUNCE_MS = 2_000;

export function useSyncOnReconnect(): void {
  const health = useTelemetryStore((s) => s.health);
  const prevStatusRef = useRef<string | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scheduleFlush = useCallback(() => {
    if (!hasPendingSync()) return;

    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const pending = queueSize();
      if (pending === 0) return;

      const { flushed, failed } = await flushQueue(abortRef.current.signal);

      if (flushed > 0) {
        console.info(`[sync] Flushed ${flushed} offline action(s). ${failed} failed.`);
      }
    }, FLUSH_DEBOUNCE_MS);
  }, []);

  // Flush when server transitions from down/null → ok
  useEffect(() => {
    const current = health?.status ?? null;

    if (
      current === 'ok' &&
      prevStatusRef.current !== null &&
      prevStatusRef.current !== 'ok'
    ) {
      scheduleFlush();
    }

    prevStatusRef.current = current;
  }, [health?.status, scheduleFlush]);

  // Also flush on first load if server is already ok and queue is non-empty
  useEffect(() => {
    if (health?.status === 'ok') {
      scheduleFlush();
    }
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      abortRef.current?.abort();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
