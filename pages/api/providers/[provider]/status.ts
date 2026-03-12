import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { NotFoundError } from '@/lib/api/errors';
import { getProvider } from '@/lib/ai/registry';
import type { AIProvider } from '@prisma/client';

export default createApiHandler(
  { methods: ['GET'] },
  async (req, res) => {
    const providerName = req.query.provider as AIProvider;
    const provider = getProvider(providerName);
    if (!provider) throw new NotFoundError('Provider');

    // Check if a server-side key is configured
    const envKeys: Record<string, string | undefined> = {
      GOOGLE_IMAGEN: process.env.GOOGLE_IMAGEN_API_KEY,
      OPENAI_DALLE: process.env.OPENAI_API_KEY,
      STABILITY: process.env.STABILITY_API_KEY,
    };

    return ok(res, {
      provider: provider.name,
      available: true,
      hasServerKey: !!envKeys[providerName],
    });
  }
);
