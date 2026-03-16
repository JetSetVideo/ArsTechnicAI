import { useCallback, useRef, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface TimelineTrack {
  id?: string;
  name: string;
  type: string;
}

export function useTimelinePersistence(projectId: string | null) {
  const { data: session } = useSession();
  const [tracks, setTracks] = useState<TimelineTrack[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTimeline = useCallback(async () => {
    if (!projectId || !session?.user) return;
    try {
      const resp = await fetch(`/api/projects/${projectId}/timeline`);
      const json = await resp.json();
      if (json.success) {
        setTracks(json.data.tracks || []);
      }
    } catch {
      // Silently fail when offline
    }
  }, [projectId, session?.user]);

  const saveTimeline = useCallback(async (data: Record<string, unknown>) => {
    if (!projectId || !session?.user) return;
    try {
      await fetch(`/api/projects/${projectId}/timeline`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {
      // Silently fail when offline
    }
  }, [projectId, session?.user]);

  const debouncedSave = useCallback((data: Record<string, unknown>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveTimeline(data), 2000);
  }, [saveTimeline]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { tracks, loadTimeline, saveTimeline, debouncedSave };
}
