import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';
import { generateSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';
import { getProvider } from '@/lib/ai/registry';
import { saveFile } from '@/lib/storage/local';
import type { AIProvider } from '@prisma/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
  }

  const {
    prompt,
    negativePrompt,
    width,
    height,
    provider,
    model,
    seed,
    steps,
    guidanceScale,
    projectId,
    apiKey,
  } = parsed.data;

  const resolvedProvider: AIProvider = (provider as AIProvider) || 'GOOGLE_IMAGEN';

  // Require API key (from body) for all generation requests
  if (!apiKey) {
    return res.status(400).json({ error: 'API key required' });
  }

  const providerInstance = getProvider(resolvedProvider);
  if (!providerInstance) {
    return res.status(400).json({ error: `Provider ${resolvedProvider} not available` });
  }

  // Create a pending job record for authenticated users (for tracking)
  let jobId: string | undefined;
  if (session?.user?.id) {
    const job = await prisma.generationJob.create({
      data: {
        userId: session.user.id,
        projectId: projectId ?? null,
        type: 'IMAGE_GENERATION',
        provider: resolvedProvider,
        model,
        prompt,
        negativePrompt,
        width,
        height,
        seed,
        steps,
        guidanceScale,
        status: 'PROCESSING',
      },
    });
    jobId = job.id;
  }

  try {
    const result = await providerInstance.generate({
      prompt,
      negativePrompt,
      width,
      height,
      model,
      seed,
      steps,
      guidanceScale,
      apiKey,
    });

    // Save asset to DB for authenticated users
    let assetId: string | undefined;
    if (session?.user?.id) {
      // Decode base64 dataUrl and persist to disk
      let filePath: string | undefined;
      try {
        if (result.dataUrl) {
          const base64Data = result.dataUrl.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const promptSlug = (prompt || 'generated')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 30);
          const filename = `gen_${promptSlug}_${timestamp}.png`;
          filePath = await saveFile(buffer, filename, 'upload');
        }
      } catch {
        // Storage failure is non-fatal; asset record will have no path
      }

      const asset = await prisma.asset.create({
        data: {
          name: `Generated image — ${prompt?.slice(0, 50) ?? 'untitled'}`,
          type: 'IMAGE',
          status: 'READY',
          path: filePath ?? null,
          mimeType: 'image/png',
          width: width ?? null,
          height: height ?? null,
          prompt: prompt ?? null,
          negativePrompt: negativePrompt ?? null,
          model: model ?? null,
          provider: resolvedProvider,
          seed: result.seed ?? null,
          steps: steps ?? null,
          guidanceScale: guidanceScale ?? null,
          userId: session.user.id,
          projectId: projectId ?? null,
        },
      });
      assetId = asset.id;

      // Update the job as completed and link to asset
      if (jobId) {
        await prisma.generationJob.update({
          where: { id: jobId },
          data: {
            status: 'COMPLETED',
            resultAssetId: assetId,
            completedAt: new Date(),
          },
        });
      }
    }

    return res.status(200).json({
      dataUrl: result.dataUrl,
      seed: result.seed,
      assetId,
      jobId,
    });
  } catch (error) {
    // Mark job as failed
    if (jobId) {
      await prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }).catch(() => {});
    }

    console.error('Generation error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};
