import { prisma } from '@/lib/prisma';
import { dequeueJob, completeJob, failJob } from './job-queue';
import { getProvider } from '@/lib/ai/registry';
import { decrypt } from '@/lib/encryption';
import { saveFile } from '@/lib/storage/local';
import { processMedia } from '@/lib/media/processor';

const MAX_CONCURRENT = parseInt(process.env.JOB_QUEUE_MAX_CONCURRENT || '3');
const POLL_INTERVAL = parseInt(process.env.JOB_QUEUE_POLL_INTERVAL_MS || '2000');
const JOB_TIMEOUT = parseInt(process.env.JOB_DEFAULT_TIMEOUT_MS || '300000');

let activeJobs = 0;
let isRunning = false;

export async function processNextJob(): Promise<boolean> {
  if (activeJobs >= MAX_CONCURRENT) return false;

  const jobId = await dequeueJob();
  if (!jobId) return false;

  activeJobs++;

  try {
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
      include: { user: { include: { apiKeys: true } } },
    });

    if (!job || job.status === 'CANCELLED') {
      await completeJob(jobId);
      return true;
    }

    // Update status to PROCESSING
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', progress: 0.1 },
    });

    const provider = getProvider(job.provider);
    if (!provider) throw new Error(`Provider ${job.provider} not found`);

    // Get API key (user key or server-side shared key)
    let apiKey = '';
    const userKey = job.user.apiKeys.find(
      (k) => k.provider === job.provider && k.isActive
    );
    if (userKey) {
      apiKey = decrypt(userKey.encryptedKey);
      await prisma.userApiKey.update({
        where: { id: userKey.id },
        data: { lastUsedAt: new Date() },
      });
    } else {
      // Try server-side shared key
      const envKeys: Record<string, string | undefined> = {
        GOOGLE_IMAGEN: process.env.GOOGLE_IMAGEN_API_KEY,
        OPENAI_DALLE: process.env.OPENAI_API_KEY,
        STABILITY: process.env.STABILITY_API_KEY,
        MIDJOURNEY: process.env.MIDJOURNEY_API_KEY,
        REPLICATE: process.env.REPLICATE_API_TOKEN,
      };
      apiKey = envKeys[job.provider] || '';
    }

    if (!apiKey) throw new Error('No API key available');

    // Generate with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), JOB_TIMEOUT);

    try {
      const result = await provider.generate({
        prompt: job.prompt || '',
        negativePrompt: job.negativePrompt || undefined,
        width: job.width || 1024,
        height: job.height || 1024,
        model: job.model || undefined,
        seed: job.seed || undefined,
        steps: job.steps || undefined,
        guidanceScale: job.guidanceScale || undefined,
        apiKey,
        requestParams: job.requestParams as Record<string, unknown> || undefined,
      });

      clearTimeout(timeout);

      // Save result as asset
      let resultAssetId: string | undefined;
      if (result.imageData) {
        const filePath = await saveFile(result.imageData, `gen-${jobId}.png`, 'upload');
        const processed = await processMedia(result.imageData, 'image/png', `gen-${jobId}.png`);

        const asset = await prisma.asset.create({
          data: {
            name: `Generated: ${(job.prompt || '').slice(0, 50)}`,
            type: 'IMAGE',
            status: 'READY',
            path: filePath,
            mimeType: 'image/png',
            size: result.imageData.length,
            width: processed.width || job.width,
            height: processed.height || job.height,
            thumbnailPath: processed.thumbnailPath,
            previewPath: processed.previewPath,
            colorPalette: processed.colorPalette,
            prompt: job.prompt,
            negativePrompt: job.negativePrompt,
            model: job.model,
            provider: job.provider,
            seed: result.seed,
            steps: job.steps,
            guidanceScale: job.guidanceScale,
            userId: job.userId,
            projectId: job.projectId,
          },
        });
        resultAssetId = asset.id;
      }

      // Update job to COMPLETED
      await prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          progress: 1.0,
          resultAssetId,
          resultData: {
            seed: result.seed,
            dataUrl: result.dataUrl,
            metadata: result.metadata,
          },
          completedAt: new Date(),
        },
      });

      await completeJob(jobId);
    } catch (genError) {
      clearTimeout(timeout);
      throw genError;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Job ${jobId} failed:`, errorMsg);

    const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
    const shouldRetry = job && job.retryCount < job.maxRetries;

    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: shouldRetry ? 'QUEUED' : 'FAILED',
        error: errorMsg,
        retryCount: { increment: 1 },
        progress: 0,
      },
    });

    await failJob(jobId, !!shouldRetry);
  } finally {
    activeJobs--;
  }

  return true;
}

export function startWorker(): void {
  if (isRunning) return;
  isRunning = true;

  const poll = async () => {
    if (!isRunning) return;
    try {
      await processNextJob();
    } catch (error) {
      console.error('Worker poll error:', error);
    }
    setTimeout(poll, POLL_INTERVAL);
  };

  poll();
  console.log(`Job queue worker started (max concurrent: ${MAX_CONCURRENT}, poll: ${POLL_INTERVAL}ms)`);
}

export function stopWorker(): void {
  isRunning = false;
}
