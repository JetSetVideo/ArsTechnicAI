import { BaseProvider, type GenerationParams, type GenerationOutput, type ProviderCapabilities } from '../base-provider';
import type { AIProvider } from '@prisma/client';

export class OpenAIDalleProvider extends BaseProvider {
  readonly name: AIProvider = 'OPENAI_DALLE';
  readonly displayName = 'OpenAI DALL-E';
  readonly capabilities: ProviderCapabilities = {
    supportedTypes: ['IMAGE_GENERATION'],
    supportedModels: ['dall-e-3', 'dall-e-2'],
    maxWidth: 1792,
    maxHeight: 1792,
    supportsNegativePrompt: false,
    supportsSeed: false,
    supportsSteps: false,
    supportsGuidanceScale: false,
  };

  async generate(params: GenerationParams): Promise<GenerationOutput> {
    const model = params.model || 'dall-e-3';

    // Determine valid size for DALL-E
    let size: string;
    if (model === 'dall-e-3') {
      if (params.width > params.height) size = '1792x1024';
      else if (params.height > params.width) size = '1024x1792';
      else size = '1024x1024';
    } else {
      size = params.width <= 256 ? '256x256' : params.width <= 512 ? '512x512' : '1024x1024';
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: params.prompt,
        n: 1,
        size,
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `DALL-E API error: ${response.status}`);
    }

    const data = await response.json();
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error('No image data in response');

    return {
      imageData: Buffer.from(b64, 'base64'),
      dataUrl: `data:image/png;base64,${b64}`,
      metadata: { revised_prompt: data.data?.[0]?.revised_prompt },
    };
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
