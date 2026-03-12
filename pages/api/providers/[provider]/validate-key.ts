import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { NotFoundError, ValidationError } from '@/lib/api/errors';
import { getProvider } from '@/lib/ai/registry';
import type { AIProvider } from '@prisma/client';

export default createApiHandler(
  { methods: ['POST'] },
  async (req, res) => {
    const providerName = req.query.provider as AIProvider;
    const { apiKey } = req.body;

    if (!apiKey) throw new ValidationError('API key is required');

    const provider = getProvider(providerName);
    if (!provider) throw new NotFoundError('Provider');

    const valid = await provider.validateKey(apiKey);
    return ok(res, { valid });
  }
);
