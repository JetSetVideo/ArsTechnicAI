import { BaseProvider, type GenerationParams, type GenerationOutput, type ProviderCapabilities } from '../base-provider';
import type { AIProvider } from '@prisma/client';

export class StabilityProvider extends BaseProvider {
  readonly name: AIProvider = 'STABILITY';
  readonly displayName = 'Stability AI';
  readonly capabilities: ProviderCapabilities = {
    supportedTypes: ['IMAGE_GENERATION', 'UPSCALE', 'INPAINT'],
    supportedModels: ['stable-diffusion-xl-1024-v1-0', 'sd3-medium', 'sd3-large', 'sd3.5-large'],
    maxWidth: 2048,
    maxHeight: 2048,
    supportsNegativePrompt: true,
    supportsSeed: true,
    supportsSteps: true,
    supportsGuidanceScale: true,
  };

  async generate(params: GenerationParams): Promise<GenerationOutput> {
    const model = params.model || 'sd3.5-large';

    const response = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/sd3`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${params.apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt: params.prompt,
        negative_prompt: params.negativePrompt,
        output_format: 'png',
        seed: params.seed,
        cfg_scale: params.guidanceScale,
        steps: params.steps,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Stability API error: ${response.status}`);
    }

    const data = await response.json();
    const b64 = data.image;
    if (!b64) throw new Error('No image data in response');

    return {
      imageData: Buffer.from(b64, 'base64'),
      dataUrl: `data:image/png;base64,${b64}`,
      seed: data.seed,
    };
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.stability.ai/v1/user/account', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
