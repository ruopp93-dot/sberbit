// Crypto rates with optional Upstash Redis persistence.
// If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set,
// rates are stored in Redis (shared across all Vercel Lambda instances).
// Otherwise falls back to globalThis (works locally / single-instance).

export interface ExchangeRate {
  currency: string;
  rub: number;
  lastUpdate: Date;
}

export type Rates = Record<string, ExchangeRate>;

// ─── globalThis fallback ────────────────────────────────────────────────────
const globalKey = '__SB_CRYPTO_RATES_V1__';
const _g: any = globalThis as any;

if (!_g[globalKey]) {
  _g[globalKey] = {
    BTC:  { currency: 'BTC',  rub: Number(process.env.DEFAULT_BTC_RATE)  || 3500000, lastUpdate: new Date() },
    ETH:  { currency: 'ETH',  rub: Number(process.env.DEFAULT_ETH_RATE)  || 180000,  lastUpdate: new Date() },
    USDT: { currency: 'USDT', rub: Number(process.env.DEFAULT_USDT_RATE) || 95.45,   lastUpdate: new Date() },
  } as Rates;
}
const memRates: Rates = _g[globalKey];

// ─── Redis helpers (lazy, no-throw) ─────────────────────────────────────────
const REDIS_KEY = 'sb:rates';

function getRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require('@upstash/redis');
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

export async function loadRatesFromRedis(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const stored = await redis.get(REDIS_KEY);
    if (stored && typeof stored === 'object') {
      for (const [k, v] of Object.entries(stored as Rates)) {
        memRates[k] = { ...(v as ExchangeRate), lastUpdate: new Date((v as any).lastUpdate) };
      }
    }
  } catch { /* ignore */ }
}

async function saveRatesToRedis(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(REDIS_KEY, memRates, { ex: 86400 }); // TTL 24h
  } catch { /* ignore */ }
}

// ─── Public API ──────────────────────────────────────────────────────────────
export function getRates(): Rates {
  return memRates;
}

export function updateRate(currency: string, rubPrice: number): void {
  memRates[currency] = { currency, rub: rubPrice, lastUpdate: new Date() };
  // Persist to Redis (fire-and-forget)
  saveRatesToRedis().catch(() => {});
  // Notify SSE clients
  try {
    const key = '__SB_RATES_SSE_CLIENTS_V1__';
    const g: any = globalThis as any;
    const clients: Set<any> = g[key];
    if (clients?.size) {
      const payload = JSON.stringify(memRates);
      for (const ctl of Array.from(clients)) {
        try { ctl.enqueue(`data: ${payload}\n\n`); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
}

export function getRateValue(fromCurrency: string, toCurrency: string): number {
  const MARKUP: Record<string, number> = { BTC: 6, ETH: 5, USDT: 7, default: 5 };
  if (fromCurrency === 'RUB') {
    const c = memRates[toCurrency];
    if (!c) return 0;
    return 1 / (c.rub * (1 + (MARKUP[toCurrency] ?? MARKUP.default) / 100));
  }
  if (toCurrency === 'RUB') {
    const c = memRates[fromCurrency];
    if (!c) return 0;
    return c.rub * (1 + (MARKUP[fromCurrency] ?? MARKUP.default) / 100);
  }
  return 0;
}
