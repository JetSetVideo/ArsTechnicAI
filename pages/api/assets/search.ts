import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { unifiedSearch } from '@/lib/search';

export default createApiHandler(
  { methods: ['GET'] },
  async (req, res) => {
    const query = (req.query.q as string) || '';
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    if (!query.trim()) {
      return ok(res, []);
    }

    const results = await unifiedSearch(query, req.userId, limit);
    return ok(res, results);
  }
);
