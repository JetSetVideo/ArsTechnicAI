import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export type ConnectionStatus = 'pending' | 'connected' | 'denied' | 'unauthenticated';

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

const POLL_INTERVAL_MS = 30_000;

export function useConnectionStatus(): ConnectionState {
  const { data: session, status: sessionStatus } = useSession();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health', { method: 'GET' });
      if (!res.ok && res.status !== 503) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setHealth(data.checks ?? null);
      setHealthError(null);
      setLastChecked(new Date());
    } catch (e) {
      setHealthError(e instanceof Error ? e.message : 'Cannot reach server');
      setHealth(null);
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const id = setInterval(checkHealth, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [checkHealth]);

  // Derive connection status from health + session
  let status: ConnectionStatus;
  if (sessionStatus === 'loading' || (health === null && !healthError)) {
    status = 'pending';
  } else if (healthError || health?.database === 'error') {
    status = 'denied';
  } else if (sessionStatus === 'authenticated' && session?.user) {
    status = 'connected';
  } else {
    // Backend reachable but user not authenticated — neutral state (not an error)
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
