import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { fetchWebImages } from '@/lib/search/webImages';

export default createApiHandler(
  { methods: ['GET'], auth: false },
  async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const images = await fetchWebImages(query, 8);
    return ok(res, images);
  }
);
