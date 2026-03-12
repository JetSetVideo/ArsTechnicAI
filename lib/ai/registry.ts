import type { AIProvider } from '@prisma/client';
import { BaseProvider } from './base-provider';
import { GoogleImagenProvider } from './providers/google-imagen';
import { OpenAIDalleProvider } from './providers/openai-dalle';
import { StabilityProvider } from './providers/stability';

const providers = new Map<AIProvider, BaseProvider>();

function register(provider: BaseProvider) {
  providers.set(provider.name, provider);
}

// Register all providers
register(new GoogleImagenProvider());
register(new OpenAIDalleProvider());
register(new StabilityProvider());

export function getProvider(name: AIProvider): BaseProvider | undefined {
  return providers.get(name);
}

export function getAllProviders(): BaseProvider[] {
  return [...providers.values()];
}

export function getProviderCapabilities() {
  return getAllProviders().map((p) => ({
    name: p.name,
    displayName: p.displayName,
    capabilities: p.capabilities,
  }));
}
