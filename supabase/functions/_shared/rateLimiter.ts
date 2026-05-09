/**
 * rateLimiter.ts — Enterprise Rate Limiting for Edge Functions
 * ============================================================
 * In-memory rate limiter scoped per company_id.
 * Prevents a single tenant from saturating the system.
 * Pattern: Token Bucket (same as Cloudflare, Stripe, HubSpot API).
 *
 * Limits (configurable):
 *   - Default: 60 requests / minute per company
 *   - Marketing engine: 20 requests / minute (expensive ops)
 *   - AI endpoints: 10 requests / minute (token-heavy)
 */

interface BucketEntry {
  count: number;
  resetAt: number;
}

// In-memory store — resets when the Edge Function cold-starts (acceptable for rate limiting)
const buckets = new Map<string, BucketEntry>();

export type RateLimitTier = 'default' | 'marketing' | 'ai';

const LIMITS: Record<RateLimitTier, { max: number; windowMs: number }> = {
  default: { max: 60, windowMs: 60_000 },
  marketing: { max: 20, windowMs: 60_000 },
  ai: { max: 10, windowMs: 60_000 },
};

/**
 * checkRateLimit — call at the top of each Edge Function handler
 *
 * @param companyId - UUID of the tenant company
 * @param tier - 'default' | 'marketing' | 'ai'
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  companyId: string,
  tier: RateLimitTier = 'default'
): { allowed: boolean; remaining: number; resetAt: number } {
  const { max, windowMs } = LIMITS[tier];
  const now = Date.now();
  const key = `${companyId}:${tier}`;

  let bucket = buckets.get(key);

  // Reset bucket if window expired
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count++;

  return {
    allowed: bucket.count <= max,
    remaining: Math.max(0, max - bucket.count),
    resetAt: bucket.resetAt,
  };
}

/**
 * rateLimitResponse — returns a 429 Response with standard headers
 */
export function rateLimitResponse(resetAt: number): Response {
  return new Response(
    JSON.stringify({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again shortly.',
      reset_at: new Date(resetAt).toISOString(),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
        'X-RateLimit-Limit': String(Object.values(LIMITS)[0].max),
        'X-RateLimit-Reset': String(resetAt),
      },
    }
  );
}
