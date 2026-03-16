import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export type ConnectionStatus = 'pending' | 'connected' | 'denied' | 'unauthenticated' | 'offline';

export interface HealthData {
  database: 'ok' | 'error';
  redis: 'ok' | 'error';
  version?: string;
}

export interface ConnectionState {
  status: ConnectionStatus;
  health: HealthData | null;
  lastChecked: Date | null;
  error: string | null;
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
  retry: () => void;
  connect: () => void;
  disconnect: () => void;
}

const BASE_INTERVAL_MS = 30_000;
const MAX_INTERVAL_MS = 300_000;

export function useConnectionStatus(): ConnectionState {
  const { data: session, status: sessionStatus } = useSession();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const failCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNext = useCallback((failCount: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const delay = failCount === 0
      ? BASE_INTERVAL_MS
      : Math.min(BASE_INTERVAL_MS * Math.pow(2, failCount), MAX_INTERVAL_MS);
    timerRef.current = setTimeout(() => void checkHealthInner(), delay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkHealthInner = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setHealthError('offline');
      setHealth(null);
      setLastChecked(new Date());
      failCountRef.current += 1;
      scheduleNext(failCountRef.current);
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch('/api/health', { method: 'GET', signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok && res.status !== 503) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setHealth(data.checks ?? null);
      setHealthError(null);
      setLastChecked(new Date());
      failCountRef.current = 0;
    } catch {
      failCountRef.current += 1;
      setHealthError('offline');
      setHealth(null);
      setLastChecked(new Date());
    }
    scheduleNext(failCountRef.current);
  }, [scheduleNext]);

  const checkHealth = useCallback(async () => {
    failCountRef.current = 0;
    await checkHealthInner();
  }, [checkHealthInner]);

  useEffect(() => {
    void checkHealthInner();

    const handleOnline = () => { failCountRef.current = 0; void checkHealthInner(); };
    window.addEventListener('online', handleOnline);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('online', handleOnline);
    };
  }, [checkHealthInner]);

  let status: ConnectionStatus;
  if (healthError === 'offline') {
    status = 'offline';
  } else if (sessionStatus === 'loading' || (health === null && !healthError)) {
    status = 'pending';
  } else if (healthError || health?.database === 'error') {
    status = 'denied';
  } else if (sessionStatus === 'authenticated' && session?.user) {
    status = 'connected';
  } else {
    status = 'unauthenticated';
  }

  return {
    status,
    health,
    lastChecked,
    error: healthError,
    user: session?.user ?? null,
    retry: checkHealth,
    connect: () => signIn(),
    disconnect: () => signOut(),
  };
}
