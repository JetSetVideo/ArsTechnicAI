/**
 * useDeviceSync — keeps this machine's projects in step with the home server
 * (lib/sync/syncEngine). Mounted once, in pages/_app.tsx.
 *
 * Runs shortly after load, every 2 minutes, when the browser comes back online
 * and when the tab becomes visible again — only while signed in. Offline runs
 * just record status; edits stay on this machine's disk until the next run.
 */
import { useEffect, useRef } from 'react';
import { loadLatest, syncNow } from '@/lib/sync/syncEngine';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import type { SyncReport } from '@/stores/syncStore';

const FIRST_RUN_MS = 5_000;
const INTERVAL_MS = 2 * 60_000;

export function useDeviceSync(): void {
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  // One "Load latest" notice per open project until it is taken.
  const offered = useRef(new Set<string>());

  const notify = (report: SyncReport | null) => {
    if (!report) return;
    const toast = useToastStore.getState();
    for (const c of report.conflicts) {
      toast.addToast({
        type: 'warning',
        title: `Kept both versions of “${c.name}”`,
        message: `It changed here and on ${c.serverDevice ?? 'another device'}. The other device's version is in “${c.name}”; yours is in “${c.copyName}”.`,
        duration: 15000,
      });
    }
    for (const d of report.deferred) {
      if (offered.current.has(d.id)) continue;
      offered.current.add(d.id);
      toast.addToast({
        type: 'info',
        title: `“${d.name}” changed on another device`,
        message: 'It is open here, so it was not replaced. Load the latest version when you are ready — unsynced work here is kept as a copy.',
        action: {
          label: 'Load latest',
          onClick: () => {
            offered.current.delete(d.id);
            void loadLatest(d.id).then(notify);
          },
        },
      });
    }
  };

  useEffect(() => {
    if (!signedIn || typeof window === 'undefined') return;
    const run = () => {
      if (document.visibilityState === 'visible') void syncNow().then(notify);
    };
    const first = window.setTimeout(run, FIRST_RUN_MS);
    const every = window.setInterval(run, INTERVAL_MS);
    const onVisible = () => document.visibilityState === 'visible' && run();
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [signedIn]);
}
