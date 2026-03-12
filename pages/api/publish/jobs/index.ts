import { createApiHandler } from '@/lib/api/handler';
import { created } from '@/lib/api/response';
import { publishJobSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['POST'], role: 'CREATOR', bodySchema: publishJobSchema },
  async (req, res) => {
    const data = req.body;

    const job = await prisma.publishJob.create({
      data: {
        projectId: data.projectId,
        publishAccountId: data.publishAccountId,
        platform: data.platform,
        title: data.title,
        description: data.description,
        hashtags: data.hashtags || [],
        platformSettings: data.platformSettings,
        status: 'DRAFT',
      },
    });

    return created(res, job);
  }
);
