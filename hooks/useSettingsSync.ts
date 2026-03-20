import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Syncs the local settingsStore with the server-side UserSettings.
 * - On login: loads DB settings and merges into local store.
 * - On settings change: debounced PUT to /api/users/me/settings.
 */
export function useSettingsSync() {
  const { data: session, status } = useSession();
  const { settings, updateSettings } = useSettingsStore();
  const lastSyncedRef = useRef<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  // Load from DB when user logs in
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user || loadedRef.current) return;

    loadedRef.current = true;
    (async () => {
      try {
        const res = await fetch('/api/users/me/settings');
        if (!res.ok) return;
        const { data } = await res.json();
        if (!data) return;

        // Merge DB settings into local store (DB wins for display prefs, local wins for API key)
        updateSettings({
          theme: data.theme ?? settings.theme,
          showGrid: data.showGrid ?? settings.showGrid,
          snapToGrid: data.snapToGrid ?? settings.snapToGrid,
          gridSize: data.gridSize ?? settings.gridSize,
          autoSavePrompts: data.autoSavePrompts ?? settings.autoSavePrompts,
          aiProvider: {
            ...(settings.aiProvider ?? {}),
            model: data.defaultModel ?? settings.aiProvider?.model ?? 'imagen-3.0-generate-002',
          },
        });
      } catch {
        // Non-fatal, keep local settings
      }
    })();
  }, [status, session?.user, settings, updateSettings]);

  // Reset on logout so next login reloads
  useEffect(() => {
    if (status === 'unauthenticated') {
      loadedRef.current = false;
    }
  }, [status]);

  // Push changes to DB (debounced 2s) + always save to disk
  useEffect(() => {
    const settingsPayload = {
      theme: settings.theme,
      showGrid: settings.showGrid,
      snapToGrid: settings.snapToGrid,
      gridSize: settings.gridSize,
      autoSavePrompts: settings.autoSavePrompts,
      defaultModel: settings.aiProvider?.model,
    };

    const key = JSON.stringify(settingsPayload);
    if (key === lastSyncedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      lastSyncedRef.current = key;

      // Always save to disk (works without auth)
      try {
        await fetch('/api/workspace/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings }),
        });
      } catch {
        // Disk save non-fatal
      }

      // Push to DB if authenticated
      if (session?.user) {
        try {
          await fetch('/api/users/me/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settingsPayload),
          });
        } catch {
          // DB sync non-fatal
        }
      }
    }, 2000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [session?.user, settings]);
}
