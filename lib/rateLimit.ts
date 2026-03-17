/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Keyed by an arbitrary string (e.g. "wish:{ip}", "message:{userId}").
 * The store lives in module scope — it resets on cold start, which is
 * expected and acceptable for serverless / Next.js deployments.
 *
 * Usage:
 *   const { allowed } = checkRateLimit(`wish:${ip}`, 10, 10 * 60 * 1000);
 *   if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 */

interface Entry {
  count: number;
  windowStart: number;
}

const store = new Map<string, Entry>();

/**
 * Check (and increment) the rate-limit counter for a given key.
 *
 * @param key       Unique string identifying the caller + action (e.g. "wish:203.0.113.4")
 * @param limit     Maximum number of requests allowed within the window
 * @param windowMs  Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);

  // New key, or window has expired — start a fresh window
  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1 };
  }

  // Within the window and already at the limit
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  // Within the window and still under the limit
  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}
