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
    const resp = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = await resp.json();

    if (json.success && json.data?.jobId) {
      const jobId = json.data.jobId;
      setActiveJobs((prev) => new Map(prev).set(jobId, {
        id: jobId,
        status: 'QUEUED',
        progress: 0,
      }));
      return jobId;
    }

    // Direct generation (backwards compat)
    if (json.dataUrl) {
      return { dataUrl: json.dataUrl, seed: json.seed };
    }

    throw new Error(json.error || 'Generation failed');
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
    await fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
    setActiveJobs((prev) => {
      const next = new Map(prev);
      const job = next.get(jobId);
      if (job) next.set(jobId, { ...job, status: 'CANCELLED' });
      return next;
    });
  }, []);

  return { generate, activeJobs, cancelJob };
}
