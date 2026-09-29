// Simple in-memory captcha store for dev/testing.
// Each challenge has a token, question and numeric answer and expires after TTL.
import { randomInt, randomUUID } from 'crypto';

type CaptchaEntry = { answer: string; expiresAt: number; question: string; attemptsLeft: number };

// Keep store on globalThis to survive module reloads in dev (HMR / turbopack)
const globalKey = '__SB_CAPTCHA_STORE_V1__';
const _global: any = (globalThis as any) || {};
if (!_global[globalKey]) {
  _global[globalKey] = new Map<string, CaptchaEntry>();
}
const store: Map<string, CaptchaEntry> = _global[globalKey];
const TTL_MS = 1000 * 60 * 5; // 5 minutes
const MAX_ENTRIES = 10_000;

export const CaptchaStore = {
  create(): { token: string; question: string } {
    // purge expired entries and cap the store size to avoid memory exhaustion
    const now = Date.now();
    if (store.size > 1000) {
      for (const [k, v] of store) if (v.expiresAt <= now) store.delete(k);
    }
    while (store.size >= MAX_ENTRIES) {
      const oldest = store.keys().next().value;
      if (oldest === undefined) break;
      store.delete(oldest);
    }
    // simple addition captcha
    const a = randomInt(1, 10);
    const b = randomInt(1, 10);
    const answer = String(a + b);
    const question = `${a} + ${b} = ?`;
    const token = randomUUID();
    // allow a small number of attempts for user typos
    store.set(token, { answer, question, expiresAt: Date.now() + TTL_MS, attemptsLeft: 3 });
    return { token, question };
  },
  validate(token?: string, answer?: string) {
    // treat missing token or explicitly null/undefined answer as invalid
    if (!token || answer == null) return false;
    const entry = store.get(token);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      store.delete(token);
      return false;
    }
    // normalize provided answer to string and trim whitespace
    const cleaned = String(answer).trim();
    // numeric comparison is more forgiving (handles '7' vs 7)
    const ok = Number(entry.answer) === Number(cleaned);
    if (ok) {
      // success: consume token
      store.delete(token);
      return true;
    }
    // wrong answer: decrement attempts and only delete when exhausted
    entry.attemptsLeft = (entry.attemptsLeft ?? 1) - 1;
    if (entry.attemptsLeft <= 0) {
      store.delete(token);
      console.warn(`Captcha token ${token} exhausted attempts`);
    } else {
      // update remaining attempts
      store.set(token, entry);
      console.warn(`Captcha token ${token} wrong answer, attempts left: ${entry.attemptsLeft}`);
    }
    return false;
  }
};
