import { BaseProvider, type GenerationParams, type GenerationOutput, type ProviderCapabilities } from '../base-provider';
import type { AIProvider } from '@prisma/client';

export class GoogleImagenProvider extends BaseProvider {
  readonly name: AIProvider = 'GOOGLE_IMAGEN';
  readonly displayName = 'Google Imagen';
  readonly capabilities: ProviderCapabilities = {
    supportedTypes: ['IMAGE_GENERATION'],
    supportedModels: ['imagen-3.0-generate-001', 'imagen-3.0-generate-002'],
    maxWidth: 4096,
    maxHeight: 4096,
    supportsNegativePrompt: true,
    supportsSeed: false,
    supportsSteps: false,
    supportsGuidanceScale: false,
  };

  async generate(params: GenerationParams): Promise<GenerationOutput> {
    const model = params.model || 'imagen-3.0-generate-001';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${params.apiKey}`;

    const aspectRatio =
      params.width === params.height ? '1:1' : params.width > params.height ? '16:9' : '9:16';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: params.prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio,
          negativePrompt: params.negativePrompt || undefined,
        },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Imagen API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.predictions?.[0]?.bytesBase64Encoded) {
      const base64 = data.predictions[0].bytesBase64Encoded;
      return {
        imageData: Buffer.from(base64, 'base64'),
        dataUrl: `data:image/png;base64,${base64}`,
        seed: Math.floor(Math.random() * 1000000),
      };
    }

    throw new Error('No image data in response');
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}
