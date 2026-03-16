import { useState, useCallback, useRef, useEffect } from 'react';

interface JobStatus {
  id: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  progressMessage?: string;
  error?: string;
  resultAssetId?: string;
  resultData?: {
    dataUrl?: string;
    seed?: number;
  };
}

export function useGeneration() {
  const [activeJobs, setActiveJobs] = useState<Map<string, JobStatus>>(new Map());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generate = useCallback(async (params: {
    prompt: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    provider?: string;
    model?: string;
    projectId?: string;
  }) => {
    let resp: Response;
    try {
      resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
    } catch {
      throw new Error('Network error: cannot reach the generation API. Check your connection.');
    }

    let json: Record<string, unknown>;
    try {
      json = await resp.json();
    } catch {
      throw new Error(`Server returned invalid response (HTTP ${resp.status})`);
    }

    if (!resp.ok && !json.dataUrl) {
      throw new Error((json.error as string) || (json.message as string) || `Generation failed (HTTP ${resp.status})`);
    }

    if (json.success && (json.data as Record<string, unknown>)?.jobId) {
      const jobId = (json.data as Record<string, unknown>).jobId as string;
      setActiveJobs((prev) => new Map(prev).set(jobId, {
        id: jobId,
        status: 'QUEUED',
        progress: 0,
      }));
      return jobId;
    }

    if (json.dataUrl) {
      return { dataUrl: json.dataUrl as string, seed: json.seed as number | undefined };
    }

    throw new Error((json.error as string) || 'Generation failed');
  }, []);

  const pollJobs = useCallback(async () => {
    const pending = [...activeJobs.entries()].filter(
      ([, j]) => j.status === 'QUEUED' || j.status === 'PROCESSING'
    );
    if (pending.length === 0) return;

    for (const [jobId] of pending) {
      try {
        const resp = await fetch(`/api/jobs/${jobId}`);
        const json = await resp.json();
        if (json.success) {
          setActiveJobs((prev) => new Map(prev).set(jobId, json.data));
        }
      } catch {
        // Ignore poll errors
      }
    }
  }, [activeJobs]);

  // Start/stop polling based on active jobs
  useEffect(() => {
    const hasPending = [...activeJobs.values()].some(
      (j) => j.status === 'QUEUED' || j.status === 'PROCESSING'
    );

    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(pollJobs, 2000);
    } else if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeJobs, pollJobs]);

  const cancelJob = useCallback(async (jobId: string) => {
    try {
      await fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
    } catch {
      // Network error — still mark locally as cancelled
    }
    setActiveJobs((prev) => {
      const next = new Map(prev);
      const job = next.get(jobId);
      if (job) next.set(jobId, { ...job, status: 'CANCELLED' });
      return next;
    });
  }, []);

  return { generate, activeJobs, cancelJob };
}
