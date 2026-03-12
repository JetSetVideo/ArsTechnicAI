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

    return ok(res, {
      provider: provider.name,
      models: provider.getModels(),
    });
  }
);
