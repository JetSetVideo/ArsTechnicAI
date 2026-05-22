import {
  BaseProvider,
  type GenerationParams,
  type GenerationOutput,
  type ProviderCapabilities,
} from '../base-provider';
import type { AIProvider } from '@prisma/client';
import { REPLICATE_MODELS } from '../catalog';

export class ReplicateProvider extends BaseProvider {
  readonly name = 'REPLICATE' as AIProvider;
  readonly displayName = 'Replicate';
  readonly capabilities: ProviderCapabilities = {
    supportedTypes: ['IMAGE_GENERATION'],
    supportedModels: REPLICATE_MODELS.map((m) => m.id),
    maxWidth: 2048,
    maxHeight: 2048,
    supportsNegativePrompt: true,
    supportsSeed: true,
    supportsSteps: true,
    supportsGuidanceScale: true,
  };

  private getModelDef(modelId: string) {
    return REPLICATE_MODELS.find((m) => m.id === modelId) ?? REPLICATE_MODELS[0];
  }

  async generate(params: GenerationParams): Promise<GenerationOutput> {
    const modelId = params.model || 'black-forest-labs/flux-schnell';
    const def = this.getModelDef(modelId);

    const body: Record<string, unknown> = {
      input: this.buildInput(modelId, params, def),
    };

    const createRes = await fetch(`https://api.replicate.com/v1/models/${modelId}/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'wait=60',
      },
      body: JSON.stringify(body),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(err.detail || `Replicate error: ${createRes.status}`);
    }

    const prediction = await createRes.json();

    // Prefer: wait=60 may have completed it synchronously
    if (prediction.status === 'succeeded') {
      return this.extractOutput(prediction.output);
    }

    // Otherwise poll
    return this.poll(prediction.urls.get, params.apiKey);
  }

  private buildInput(
    modelId: string,
    params: GenerationParams,
    def: (typeof REPLICATE_MODELS)[number],
  ): Record<string, unknown> {
    const aspect = params.width > params.height ? '16:9' : params.width < params.height ? '9:16' : '1:1';
    const inp: Record<string, unknown> = {
      prompt: params.prompt,
      width: params.width,
      height: params.height,
    };
    if (modelId.includes('flux')) {
      inp.aspect_ratio = aspect;
      inp.go_fast = true;
      if (def.supportsSteps) inp.num_inference_steps = params.steps ?? 28;
      if (def.supportsGuidance) inp.guidance = params.guidanceScale ?? 3.5;
    } else if (modelId.includes('sdxl')) {
      inp.negative_prompt = params.negativePrompt ?? '';
      inp.num_inference_steps = params.steps ?? 30;
      inp.guidance_scale = params.guidanceScale ?? 7.5;
    } else {
      if (def.supportsNegative) inp.negative_prompt = params.negativePrompt ?? '';
    }
    if (params.seed) inp.seed = params.seed;
    inp.num_outputs = 1;
    return inp;
  }

  private async poll(
    url: string,
    apiKey: string,
    maxWait = 120_000,
  ): Promise<GenerationOutput> {
    const headers = { Authorization: `Bearer ${apiKey}` };
    const started = Date.now();

    while (Date.now() - started < maxWait) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Replicate poll failed: ${res.status}`);
      const data = await res.json();
      if (data.status === 'succeeded') return this.extractOutput(data.output);
      if (data.status === 'failed') throw new Error(data.error ?? 'Replicate job failed');
    }
    throw new Error('Replicate generation timed out');
  }

  private async extractOutput(output: unknown): Promise<GenerationOutput> {
    const url = Array.isArray(output) ? output[0] : (output as string);
    if (!url) throw new Error('No image URL in Replicate response');
    const imgRes = await fetch(url);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const dataUrl = `data:image/webp;base64,${buffer.toString('base64')}`;
    return { imageData: buffer, dataUrl };
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const res = await fetch('https://api.replicate.com/v1/account', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
