// Server-side security helpers (Node.js runtime only).
import crypto from 'crypto';
import { getRedis } from './redis';

// ─── Constant-time comparison ────────────────────────────────────────────────
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// ─── Rate limiting ───────────────────────────────────────────────────────────
// Fixed-window counters in Redis (shared by all Vercel instances); in-memory
// fallback for local development.
type Bucket = { count: number; resetAt: number };
const rlKey = '__SB_RATE_LIMIT_V1__';
const _g = globalThis as unknown as Record<string, Map<string, Bucket>>;
if (!_g[rlKey]) _g[rlKey] = new Map<string, Bucket>();
const buckets = _g[rlKey];
const MAX_BUCKETS = 50_000;

/** Returns true if the request is allowed, false if the limit is exceeded. */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    try {
      const k = `sb:rl:${key}`;
      const n = await redis.incr(k);
      if (n === 1) await redis.pexpire(k, windowMs);
      return n <= limit;
    } catch {
      return true; // do not block users if Redis is temporarily unavailable
    }
  }

  const now = Date.now();
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    if (buckets.size > MAX_BUCKETS) buckets.clear();
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/**
 * Client address for rate limiting. On Vercel the platform overwrites
 * x-real-ip / x-forwarded-for, so they cannot be spoofed by the client.
 * Locally (no proxy) everything maps to a single bucket.
 */
export function getClientIp(request: Request): string {
  if (!process.env.VERCEL) return 'local';
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0];
  return ip?.trim() || 'unknown';
}

// ─── HTML escaping (for emails etc.) ─────────────────────────────────────────
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
