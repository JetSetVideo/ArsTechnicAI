import { useEffect, useState } from 'react';
import type { CanvasProjectPictures } from '@/lib/pipeline/canvasPictures';

/** Pictures currently on each project's canvas. Loaded once for the dashboard. */
export function useCanvasPictures(): CanvasProjectPictures[] {
  const [projects, setProjects] = useState<CanvasProjectPictures[]>([]);

  useEffect(() => {
    let cancel = false;
    fetch('/api/workspace/canvas-pictures')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { projects?: CanvasProjectPictures[] } | null) => {
        if (!cancel && data?.projects) setProjects(data.projects);
      })
      .catch(() => {});
    return () => { cancel = true; };
  }, []);

  return projects;
}
