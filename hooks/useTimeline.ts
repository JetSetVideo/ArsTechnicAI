import { useCallback, useRef, useEffect, useState } from 'react';

interface TimelineTrack {
  id?: string;
  name: string;
  type: string;
}

export function useTimelinePersistence(projectId: string | null) {
  const [tracks, setTracks] = useState<TimelineTrack[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTimeline = useCallback(async () => {
    if (!projectId) return;
    try {
      const resp = await fetch(`/api/projects/${projectId}/timeline`);
      const json = await resp.json();
      if (json.success) {
        setTracks(json.data.tracks || []);
      }
    } catch (error) {
      console.error('Timeline load failed:', error);
    }
  }, [projectId]);

  const saveTimeline = useCallback(async (data: Record<string, unknown>) => {
    if (!projectId) return;
    try {
      await fetch(`/api/projects/${projectId}/timeline`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Timeline save failed:', error);
    }
  }, [projectId]);

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
