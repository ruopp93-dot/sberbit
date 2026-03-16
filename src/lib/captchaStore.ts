// Simple in-memory captcha store for dev/testing.
// Each challenge has a token, question and numeric answer and expires after TTL.
import { randomUUID } from 'crypto';

type CaptchaEntry = { answer: string; expiresAt: number; question: string; attemptsLeft: number };

// Keep store on globalThis to survive module reloads in dev (HMR / turbopack)
const globalKey = '__SB_CAPTCHA_STORE_V1__';
const _global: any = (globalThis as any) || {};
if (!_global[globalKey]) {
  _global[globalKey] = new Map<string, CaptchaEntry>();
}
const store: Map<string, CaptchaEntry> = _global[globalKey];
const TTL_MS = 1000 * 60 * 5; // 5 minutes

export const CaptchaStore = {
  create(): { token: string; question: string } {
    // simple addition captcha
    const a = Math.floor(Math.random() * 9) + 1;
    const b = Math.floor(Math.random() * 9) + 1;
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
      console.warn(`Captcha token ${token} wrong answer, attempts left: ${entry.attemptsLeft} (provided: '${cleaned}')`);
    }
    return false;
  }
  ,
  // debug helper: return a safe copy of the entry for diagnostics (returns undefined if not found)
  peek(token?: string) {
    if (!token) return undefined;
    const entry = store.get(token);
    if (!entry) return undefined;
    // return a shallow copy (including answer) for server-side debugging only
    return { question: entry.question, answer: entry.answer, expiresAt: entry.expiresAt, attemptsLeft: entry.attemptsLeft };
  }
};
