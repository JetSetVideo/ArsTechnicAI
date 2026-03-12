import type { AIProvider, JobType } from '@prisma/client';

export interface ProviderCapabilities {
  supportedTypes: JobType[];
  supportedModels: string[];
  maxWidth: number;
  maxHeight: number;
  supportsNegativePrompt: boolean;
  supportsSeed: boolean;
  supportsSteps: boolean;
  supportsGuidanceScale: boolean;
}

export interface GenerationParams {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  model?: string;
  seed?: number;
  steps?: number;
  guidanceScale?: number;
  apiKey: string;
  requestParams?: Record<string, unknown>;
}

export interface GenerationOutput {
  imageData?: Buffer;
  dataUrl?: string;
  seed?: number;
  metadata?: Record<string, unknown>;
}

export abstract class BaseProvider {
  abstract readonly name: AIProvider;
  abstract readonly displayName: string;
  abstract readonly capabilities: ProviderCapabilities;

  abstract generate(params: GenerationParams): Promise<GenerationOutput>;

  abstract validateKey(apiKey: string): Promise<boolean>;

  getModels(): string[] {
    return this.capabilities.supportedModels;
  }
}
