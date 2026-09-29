// Server-side security helpers (Node.js runtime only).
import crypto from 'crypto';

// ─── Constant-time comparison ────────────────────────────────────────────────
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// ─── Password hashing (scrypt with per-user salt) ────────────────────────────
// Format: scrypt$<saltHex>$<hashHex>. Legacy unsalted sha256 hex hashes are still
// accepted so existing admins can log in; they are upgraded on successful login.
const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): { ok: boolean; needsRehash: boolean } {
  if (stored.startsWith('scrypt$')) {
    const [, saltHex, hashHex] = stored.split('$');
    if (!saltHex || !hashHex) return { ok: false, needsRehash: false };
    const hash = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), SCRYPT_KEYLEN);
    const expected = Buffer.from(hashHex, 'hex');
    const ok = expected.length === hash.length && crypto.timingSafeEqual(hash, expected);
    return { ok, needsRehash: false };
  }
  const legacy = crypto.createHash('sha256').update(password).digest('hex');
  return { ok: safeEqual(legacy, stored), needsRehash: true };
}

// ─── In-memory rate limiting (per instance) ──────────────────────────────────
type Bucket = { count: number; resetAt: number };
const rlKey = '__SB_RATE_LIMIT_V1__';
const _g = globalThis as unknown as Record<string, Map<string, Bucket>>;
if (!_g[rlKey]) _g[rlKey] = new Map<string, Bucket>();
const buckets = _g[rlKey];
const MAX_BUCKETS = 50_000;

/** Returns true if the request is allowed, false if the limit is exceeded. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
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

export function getClientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
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
