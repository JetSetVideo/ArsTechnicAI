import {
  BaseProvider,
  type GenerationParams,
  type GenerationOutput,
  type ProviderCapabilities,
} from '../base-provider';
import type { AIProvider } from '@prisma/client';
import { FAL_MODELS } from '../catalog';

export class FalProvider extends BaseProvider {
  readonly name = 'FAL' as AIProvider;
  readonly displayName = 'FAL';
  readonly capabilities: ProviderCapabilities = {
    supportedTypes: ['IMAGE_GENERATION'],
    supportedModels: FAL_MODELS.map((m) => m.id),
    maxWidth: 2048,
    maxHeight: 2048,
    supportsNegativePrompt: true,
    supportsSeed: true,
    supportsSteps: true,
    supportsGuidanceScale: true,
  };

  private getModelDef(modelId: string) {
    return FAL_MODELS.find((m) => m.id === modelId) ?? FAL_MODELS[0]!;
  }

  async generate(params: GenerationParams): Promise<GenerationOutput> {
    const modelId = params.model || 'fal-ai/flux/schnell';
    const def = this.getModelDef(modelId);

    // Enqueue the job
    const enqueueRes = await fetch(`https://queue.fal.run/${modelId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.buildBody(modelId, params, def)),
    });

    if (!enqueueRes.ok) {
      const err = await enqueueRes.json().catch(() => ({}));
      throw new Error(err.detail || err.message || `FAL error: ${enqueueRes.status}`);
    }

    const { request_id } = await enqueueRes.json();

    // Poll for result (FAL queue is async)
    const result = await this.pollResult(modelId, request_id, params.apiKey);
    const imageUrl: string = result.images?.[0]?.url ?? result.image?.url;
    if (!imageUrl) throw new Error('No image in FAL response');

    // Fetch image bytes to return as dataUrl
    const imgRes = await fetch(imageUrl);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const ext = imageUrl.includes('.webp') ? 'webp' : 'png';
    const dataUrl = `data:image/${ext};base64,${buffer.toString('base64')}`;

    return { imageData: buffer, dataUrl, seed: result.seed };
  }

  private buildBody(modelId: string, params: GenerationParams, def: (typeof FAL_MODELS)[number]) {
    const base: Record<string, unknown> = {
      prompt: params.prompt,
      image_size: this.resolveSize(params.width, params.height),
      num_inference_steps: def.supportsSteps ? (params.steps ?? 28) : undefined,
      guidance_scale: def.supportsGuidance ? (params.guidanceScale ?? 3.5) : undefined,
      seed: params.seed ?? undefined,
      num_images: 1,
    };
    if (def.supportsNegative && params.negativePrompt) {
      base.negative_prompt = params.negativePrompt;
    }
    return base;
  }

  private resolveSize(w: number, h: number): string {
    // FAL accepts named sizes or {width, height} — use named when possible
    const ratio = w / h;
    if (ratio > 1.7) return 'landscape_16_9';
    if (ratio > 1.2) return 'landscape_4_3';
    if (ratio < 0.6) return 'portrait_9_16';
    if (ratio < 0.85) return 'portrait_4_3';
    return 'square_hd';
  }

  private async pollResult(
    modelId: string,
    requestId: string,
    apiKey: string,
    maxWait = 120_000,
  ): Promise<Record<string, unknown>> {
    const statusUrl = `https://queue.fal.run/${modelId}/requests/${requestId}`;
    const headers = { Authorization: `Key ${apiKey}` };
    const started = Date.now();

    while (Date.now() - started < maxWait) {
      await new Promise((r) => setTimeout(r, 1500));
      const res = await fetch(statusUrl, { headers });
      if (!res.ok) throw new Error(`FAL status check failed: ${res.status}`);
      const data = await res.json();
      if (data.status === 'COMPLETED') return data.output ?? data;
      if (data.status === 'FAILED') throw new Error(data.error ?? 'FAL job failed');
    }
    throw new Error('FAL generation timed out');
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'test', num_images: 1, image_size: 'square' }),
      });
      // 200 = valid, 401/403 = invalid key, other errors = valid key with other issues
      return res.status !== 401 && res.status !== 403;
    } catch {
      return false;
    }
  }
}
