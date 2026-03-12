import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { getProviderCapabilities } from '@/lib/ai/registry';

export default createApiHandler(
  { methods: ['GET'] },
  async (_req, res) => {
    return ok(res, getProviderCapabilities());
  }
);
