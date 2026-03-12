import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PREFIX = process.env.REDIS_PREFIX || 'arstechnicai:';

export const redis =
  globalForRedis.redis ??
  new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    keyPrefix: REDIS_PREFIX,
  });

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

// Helper: get with JSON parse
export async function cacheGet<T>(key: string): Promise<T | null> {
  const val = await redis.get(key);
  if (!val) return null;
  try {
    return JSON.parse(val) as T;
  } catch {
    return null;
  }
}

// Helper: set with JSON stringify + TTL
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

// Helper: delete cache key
export async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}

// Helper: delete keys by pattern
export async function cacheDelPattern(pattern: string): Promise<void> {
  const stream = redis.scanStream({ match: `${REDIS_PREFIX}${pattern}`, count: 100 });
  const pipeline = redis.pipeline();
  for await (const keys of stream) {
    for (const key of keys as string[]) {
      // Remove prefix since keyPrefix is auto-added
      pipeline.del(key.replace(REDIS_PREFIX, ''));
    }
  }
  await pipeline.exec();
}

export default redis;
