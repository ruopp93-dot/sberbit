// Shared Upstash Redis client. On Vercel every request can hit a different
// serverless instance, so all state (orders, rates, settings, captcha, limits)
// must live in Redis. Supports both the Upstash env names and the names set by
// the Vercel Marketplace integration (KV_REST_API_*).
import { Redis } from '@upstash/redis';

let client: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  if (!client && process.env.VERCEL) {
    console.error('[redis] Upstash Redis is not configured: orders and settings will be lost between requests.');
  }
  return client;
}
