// Stateless arithmetic captcha: the answer is bound to an HMAC-signed token, so
// it works across Vercel serverless instances. Redis (when configured) tracks
// attempts and one-time use; without Redis an in-memory map is used (dev).
import { createHmac, randomInt, randomUUID } from 'crypto';
import { getRedis } from './redis';
import { safeEqual } from './security';

const TTL_MS = 1000 * 60 * 5; // 5 minutes
const MAX_ATTEMPTS = 3;

const fallbackSecret = randomUUID();
function secret() {
  return process.env.APP_SECRET || process.env.TELEGRAM_BOT_TOKEN || fallbackSecret;
}

function sign(exp: string, nonce: string, answer: string) {
  return createHmac('sha256', secret()).update(`captcha.${exp}.${nonce}.${answer}`).digest('hex');
}

const _g = globalThis as unknown as Record<string, Map<string, number>>;
const memKey = '__SB_CAPTCHA_ATTEMPTS_V2__';
if (!_g[memKey]) _g[memKey] = new Map<string, number>();
const memAttempts = _g[memKey];

/** Counts an attempt; returns false once the token is used up (too many tries or already solved). */
async function registerAttempt(nonce: string, success: boolean): Promise<boolean> {
  const ttlSec = Math.ceil(TTL_MS / 1000);
  const redis = getRedis();
  if (redis) {
    const key = `sb:captcha:${nonce}`;
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, ttlSec);
    if (n > MAX_ATTEMPTS) return false;
    if (success) await redis.set(key, MAX_ATTEMPTS + 1, { ex: ttlSec }); // one-time use
    return true;
  }
  if (memAttempts.size > 10_000) memAttempts.clear();
  const n = (memAttempts.get(nonce) ?? 0) + 1;
  memAttempts.set(nonce, success ? MAX_ATTEMPTS + 1 : n);
  return n <= MAX_ATTEMPTS;
}

export const CaptchaStore = {
  create(): { token: string; question: string } {
    const a = randomInt(1, 10);
    const b = randomInt(1, 10);
    const exp = String(Date.now() + TTL_MS);
    const nonce = randomUUID();
    return { token: `${exp}.${nonce}.${sign(exp, nonce, String(a + b))}`, question: `${a} + ${b} = ?` };
  },

  async validate(token?: string, answer?: string): Promise<boolean> {
    if (!token || answer == null) return false;
    const [exp, nonce, sig] = token.split('.');
    if (!exp || !nonce || !sig || !(Number(exp) > Date.now())) return false;
    const cleaned = String(answer).trim();
    if (!/^\d{1,3}$/.test(cleaned)) return false;
    const ok = safeEqual(sign(exp, nonce, String(Number(cleaned))), sig);
    const allowed = await registerAttempt(nonce, ok);
    return ok && allowed;
  },
};
