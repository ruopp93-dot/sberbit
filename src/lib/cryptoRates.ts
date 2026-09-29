// Crypto rates (RUB per 1 coin), stored in Upstash Redis so that every Vercel
// instance sees the same values. Rates are refreshed from the market (CoinGecko,
// fallback Binance + CBR) at most once a minute; a currency whose rate the admin
// set manually via the Telegram bot keeps that value until switched back to auto.
import { getRedis } from './redis';

export interface ExchangeRate {
  currency: string;
  rub: number;
  lastUpdate: string; // ISO date
  manual?: boolean;
}

export type Rates = Record<string, ExchangeRate>;

export const CURRENCIES = ['BTC', 'ETH', 'USDT'] as const;

const REDIS_KEY = 'sb:rates';
const FETCH_LOCK_KEY = 'sb:rates:fetchedAt';
const REFRESH_MS = 60_000;

function defaults(): Rates {
  const now = new Date().toISOString();
  return {
    BTC: { currency: 'BTC', rub: Number(process.env.DEFAULT_BTC_RATE) || 3500000, lastUpdate: now },
    ETH: { currency: 'ETH', rub: Number(process.env.DEFAULT_ETH_RATE) || 180000, lastUpdate: now },
    USDT: { currency: 'USDT', rub: Number(process.env.DEFAULT_USDT_RATE) || 95.45, lastUpdate: now },
  };
}

// in-memory fallback for local development without Redis
const memKey = '__SB_CRYPTO_RATES_V2__';
const _g = globalThis as unknown as Record<string, { rates: Rates; fetchedAt: number }>;
if (!_g[memKey]) _g[memKey] = { rates: defaults(), fetchedAt: 0 };
const mem = _g[memKey];

async function readRates(): Promise<Rates> {
  const redis = getRedis();
  if (!redis) return mem.rates;
  try {
    const stored = await redis.get<Rates>(REDIS_KEY);
    return stored && typeof stored === 'object' ? { ...defaults(), ...stored } : defaults();
  } catch {
    return defaults();
  }
}

async function writeRates(rates: Rates): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    mem.rates = rates;
    return;
  }
  await redis.set(REDIS_KEY, rates);
}

/** Returns true if this caller should refresh market rates now (throttled globally). */
async function acquireRefresh(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    if (Date.now() - mem.fetchedAt < REFRESH_MS) return false;
    mem.fetchedAt = Date.now();
    return true;
  }
  const res = await redis.set(FETCH_LOCK_KEY, Date.now(), { nx: true, px: REFRESH_MS });
  return res === 'OK';
}

async function fetchFromCoinGecko(): Promise<Partial<Record<string, number>> | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=rub',
      { cache: 'no-store', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const out = { BTC: data?.bitcoin?.rub, ETH: data?.ethereum?.rub, USDT: data?.tether?.rub };
    return out.BTC || out.USDT ? out : null;
  } catch {
    return null;
  }
}

async function fetchFromBinance(): Promise<Partial<Record<string, number>> | null> {
  try {
    const opts = { cache: 'no-store' as const, signal: AbortSignal.timeout(5000) };
    const [btcRes, ethRes, cbrRes] = await Promise.all([
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', opts),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT', opts),
      fetch('https://www.cbr-xml-daily.ru/daily_json.js', opts),
    ]);
    if (!btcRes.ok || !ethRes.ok || !cbrRes.ok) return null;
    const [btc, eth, cbr] = await Promise.all([btcRes.json(), ethRes.json(), cbrRes.json()]);
    const usdRub = Number(cbr?.Valute?.USD?.Value);
    const btcUsdt = parseFloat(btc?.price);
    const ethUsdt = parseFloat(eth?.price);
    if (!usdRub || !btcUsdt || !ethUsdt) return null;
    return {
      BTC: Math.round(btcUsdt * usdRub),
      ETH: Math.round(ethUsdt * usdRub),
      USDT: parseFloat(usdRub.toFixed(2)),
    };
  } catch {
    return null;
  }
}

/** Current rates; refreshes non-manual rates from the market when stale. */
export async function getRates(): Promise<Rates> {
  const rates = await readRates();
  if (!(await acquireRefresh())) return rates;

  const market = (await fetchFromCoinGecko()) ?? (await fetchFromBinance());
  if (!market) return rates;

  const now = new Date().toISOString();
  let changed = false;
  for (const c of CURRENCIES) {
    const price = Number(market[c]);
    if (rates[c]?.manual || !Number.isFinite(price) || price <= 0) continue;
    rates[c] = { currency: c, rub: price, lastUpdate: now };
    changed = true;
  }
  if (changed) await writeRates(rates);
  return rates;
}

/** Sets a manual rate (used by the admin bot). */
export async function setManualRate(currency: string, rubPrice: number): Promise<void> {
  const rates = await readRates();
  rates[currency] = { currency, rub: rubPrice, lastUpdate: new Date().toISOString(), manual: true };
  await writeRates(rates);
}

/** Switches all currencies back to automatic market rates. */
export async function resetToAutoRates(): Promise<void> {
  const rates = await readRates();
  for (const c of Object.keys(rates)) delete rates[c].manual;
  await writeRates(rates);
  const redis = getRedis();
  if (redis) await redis.del(FETCH_LOCK_KEY);
  else mem.fetchedAt = 0;
}

export function getRateValue(rates: Rates, fromCurrency: string, toCurrency: string): number {
  const MARKUP: Record<string, number> = { BTC: 6, ETH: 5, USDT: 7, default: 5 };
  if (fromCurrency === 'RUB') {
    const c = rates[toCurrency];
    if (!c) return 0;
    return 1 / (c.rub * (1 + (MARKUP[toCurrency] ?? MARKUP.default) / 100));
  }
  if (toCurrency === 'RUB') {
    const c = rates[fromCurrency];
    if (!c) return 0;
    return c.rub * (1 + (MARKUP[fromCurrency] ?? MARKUP.default) / 100);
  }
  return 0;
}
