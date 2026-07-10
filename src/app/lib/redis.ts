// src/lib/redis.ts
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;

// Singleton Redis client (reuses the same connection for BullMQ + caching)
let redis: IORedis | null = null;

export function getRedis(): IORedis | null {
  if (!REDIS_URL) return null;
  if (!redis) {
    redis = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    redis.connect().catch((err) => {
      console.warn("[Redis] Connection failed, caching disabled:", err.message);
      redis = null;
    });
  }
  return redis;
}

/**
 * Get a cached value. Returns null on miss or if Redis is unavailable.
 * Gracefully degrades — if Redis is down, the app works as before.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    const cached = await client.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

/**
 * Set a cached value with TTL (in seconds).
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Silently fail — caching is an optimization, not a requirement
  }
}

/**
 * Invalidate (delete) one or more cache keys.
 * Supports wildcards via SCAN for pattern-based invalidation.
 */
export async function cacheInvalidate(...keys: string[]): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    const pipeline = client.pipeline();
    for (const key of keys) {
      if (key.includes("*")) {
        // Pattern-based invalidation using SCAN (non-blocking)
        let cursor = "0";
        do {
          const [nextCursor, matchedKeys] = await client.scan(
            cursor, "MATCH", key, "COUNT", 100
          );
          cursor = nextCursor;
          for (const mk of matchedKeys) {
            pipeline.del(mk);
          }
        } while (cursor !== "0");
      } else {
        pipeline.del(key);
      }
    }
    await pipeline.exec();
  } catch {
    // Silently fail
  }
}
