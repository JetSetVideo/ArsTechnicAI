/**
 * GenerationService — pure business logic layer around the generation pipeline.
 * Wraps /api/generate, tracks jobs via generationStore, and emits domain events.
 * Keep this free of React — no hooks, no JSX.
 */

import { bus } from '@/lib/events/bus';

interface GenerateParams {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  model: string;
  apiKey: string;
  projectId?: string;
}

interface GenerateResult {
  dataUrl?: string;
  imageUrl?: string;
  seed?: number;
  assetId?: string;
  jobId?: string;
  filePath?: string;
}

export class GenerationService {
  private baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  async generate(jobId: string, params: GenerateParams): Promise<GenerateResult> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = err.error ?? `Generation failed (HTTP ${response.status})`;
      bus.emit('generation:failed', { jobId, error: message });
      throw new Error(message);
    }

    const result: GenerateResult = await response.json();
    bus.emit('generation:completed', {
      jobId,
      assetId: result.assetId,
      seed: result.seed,
      filePath: result.filePath,
    });
    return result;
  }

  async cancel(jobId: string): Promise<void> {
    bus.emit('generation:cancelled', { jobId });
  }
}

export const generationService = new GenerationService();
