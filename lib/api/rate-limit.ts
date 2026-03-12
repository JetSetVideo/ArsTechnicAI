import redis from '@/lib/redis';
import { RateLimitError } from './errors';
import type { NextApiResponse } from 'next';

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60');
const GENERATION_MAX = parseInt(process.env.RATE_LIMIT_GENERATION_MAX || '10');

interface RateLimitResult {
  remaining: number;
  limit: number;
  reset: number;
}

async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Sliding window counter using sorted set
  const multi = redis.multi();
  multi.zremrangebyscore(key, 0, windowStart);
  multi.zadd(key, now, `${now}-${Math.random()}`);
  multi.zcard(key);
  multi.pexpire(key, windowMs);

  const results = await multi.exec();
  const count = (results?.[2]?.[1] as number) || 0;

  return {
    remaining: Math.max(0, maxRequests - count),
    limit: maxRequests,
    reset: Math.ceil((now + windowMs) / 1000),
  };
}

export async function rateLimit(
  userId: string,
  endpoint: string,
  res: NextApiResponse,
  isGeneration = false
): Promise<void> {
  const maxReqs = isGeneration ? GENERATION_MAX : MAX_REQUESTS;
  const key = `ratelimit:${userId}:${endpoint}`;

  const result = await checkRateLimit(key, maxReqs, WINDOW_MS);

  res.setHeader('X-RateLimit-Limit', result.limit);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', result.reset);

  if (result.remaining <= 0) {
    const retryAfter = Math.ceil(WINDOW_MS / 1000);
    res.setHeader('Retry-After', retryAfter);
    throw new RateLimitError(WINDOW_MS);
  }
}
