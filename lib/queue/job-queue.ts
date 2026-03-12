import redis from '@/lib/redis';

const QUEUE_KEY = 'queue:generation';
const PROCESSING_KEY = 'queue:processing';

export interface QueuedJob {
  jobId: string;
  priority: number;
  timestamp: number;
}

export async function enqueueJob(jobId: string, priority = 0): Promise<void> {
  // Score = priority * 1e13 + timestamp (higher priority = lower score = dequeued first)
  const score = (10 - priority) * 1e13 + Date.now();
  await redis.zadd(QUEUE_KEY, score, jobId);
}

export async function dequeueJob(): Promise<string | null> {
  // Get the job with lowest score (highest priority, oldest)
  const result = await redis.zpopmin(QUEUE_KEY);
  if (!result || result.length === 0) return null;
  const jobId = result[0];
  await redis.sadd(PROCESSING_KEY, jobId);
  return jobId;
}

export async function completeJob(jobId: string): Promise<void> {
  await redis.srem(PROCESSING_KEY, jobId);
}

export async function failJob(jobId: string, requeue = false): Promise<void> {
  await redis.srem(PROCESSING_KEY, jobId);
  if (requeue) {
    await enqueueJob(jobId, 0);
  }
}

export async function cancelJob(jobId: string): Promise<void> {
  await redis.zrem(QUEUE_KEY, jobId);
  await redis.srem(PROCESSING_KEY, jobId);
}

export async function getQueueStats(): Promise<{
  queued: number;
  processing: number;
}> {
  const [queued, processing] = await Promise.all([
    redis.zcard(QUEUE_KEY),
    redis.scard(PROCESSING_KEY),
  ]);
  return { queued, processing };
}

export async function getQueuedJobIds(limit = 20): Promise<string[]> {
  return redis.zrange(QUEUE_KEY, 0, limit - 1);
}
