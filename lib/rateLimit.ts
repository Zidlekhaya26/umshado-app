/**
 * Sliding-window rate limiter backed by Upstash Redis.
 *
 * Falls back to an in-memory store automatically when
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set,
 * so local development and staging environments work without Redis.
 *
 * Usage (async):
 *   const { allowed } = await checkRateLimit(`wish:${ip}`, 10, 10 * 60 * 1000);
 *   if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 */

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// ── In-memory fallback ────────────────────────────────────────────────────────
interface Entry { count: number; windowStart: number }
const memStore = new Map<string, Entry>();

function checkInMemory(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    memStore.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) return { allowed: false, remaining: 0 };
  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}

// ── Upstash Redis setup ───────────────────────────────────────────────────────
let redis: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

/** Convert milliseconds to the "@upstash/ratelimit" Duration string format. */
function msToDuration(ms: number): `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}` {
  if (ms % 86_400_000 === 0) return `${ms / 86_400_000} d`;
  if (ms % 3_600_000 === 0)  return `${ms / 3_600_000} h`;
  if (ms % 60_000 === 0)     return `${ms / 60_000} m`;
  if (ms % 1_000 === 0)      return `${ms / 1_000} s`;
  return `${ms} ms`;
}

// One Ratelimit instance per (limit, windowMs) pair — created lazily and cached.
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  if (!limiterCache.has(cacheKey)) {
    limiterCache.set(cacheKey, new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, msToDuration(windowMs)),
      prefix: 'umshado:rl',
    }));
  }
  return limiterCache.get(cacheKey)!;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check (and increment) the rate-limit counter for a given key.
 *
 * @param key       Unique string identifying the caller + action (e.g. "wish:203.0.113.4")
 * @param limit     Maximum number of requests allowed within the window
 * @param windowMs  Window duration in milliseconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number }> {
  if (!redis) {
    // Upstash not configured — use in-memory fallback (resets on cold start)
    return checkInMemory(key, limit, windowMs);
  }
  try {
    const { success, remaining } = await getLimiter(limit, windowMs).limit(key);
    return { allowed: success, remaining };
  } catch {
    // Redis unreachable — fail open (log and fall back to in-memory)
    console.error(JSON.stringify({ event: 'rate_limit_redis_error', key }));
    return checkInMemory(key, limit, windowMs);
  }
}
