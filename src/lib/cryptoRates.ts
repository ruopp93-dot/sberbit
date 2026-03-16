// Crypto rates stored in globalThis for persistence across requests within the same Lambda instance.
// On cold start, values are loaded from env vars (DEFAULT_BTC_RATE, DEFAULT_ETH_RATE, DEFAULT_USDT_RATE)
// so admin changes persist when env vars are kept up to date.

export interface ExchangeRate {
  currency: string;
  rub: number;
  lastUpdate: Date;
}

export type Rates = Record<string, ExchangeRate>;

const globalKey = '__SB_CRYPTO_RATES_V1__';
const _g: any = globalThis as any;

if (!_g[globalKey]) {
  _g[globalKey] = {
    BTC: { currency: 'BTC', rub: Number(process.env.DEFAULT_BTC_RATE) || 3500000, lastUpdate: new Date() },
    ETH: { currency: 'ETH', rub: Number(process.env.DEFAULT_ETH_RATE) || 180000, lastUpdate: new Date() },
    USDT: { currency: 'USDT', rub: Number(process.env.DEFAULT_USDT_RATE) || 95.45, lastUpdate: new Date() },
  } as Rates;
}

const rates: Rates = _g[globalKey];

// Markup applied on top of base rate
const MARKUP_PERCENTAGE: Record<string, number> = {
  BTC: 2,
  ETH: 2.5,
  USDT: 1.5,
  default: 2,
};

export function getRates(): Rates {
  return rates;
}

export function updateRate(currency: string, rubPrice: number): void {
  rates[currency] = {
    currency,
    rub: rubPrice,
    lastUpdate: new Date(),
  };
  // Notify SSE clients if any
  try {
    const key = '__SB_RATES_SSE_CLIENTS_V1__';
    const g: any = globalThis as any;
    const clients: Set<any> = g[key];
    if (clients && clients.size) {
      const payload = JSON.stringify(rates);
      for (const ctl of Array.from(clients)) {
        try { ctl.enqueue(`data: ${payload}\n\n`); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
}

export function getRateValue(fromCurrency: string, toCurrency: string): number {
  // RUB -> CRYPTO
  if (fromCurrency === 'RUB') {
    const crypto = rates[toCurrency];
    if (!crypto) return 0;
    const markup = MARKUP_PERCENTAGE[toCurrency] ?? MARKUP_PERCENTAGE.default;
    return 1 / (crypto.rub * (1 + markup / 100));
  }
  // CRYPTO -> RUB
  if (toCurrency === 'RUB') {
    const crypto = rates[fromCurrency];
    if (!crypto) return 0;
    const markup = MARKUP_PERCENTAGE[fromCurrency] ?? MARKUP_PERCENTAGE.default;
    return crypto.rub * (1 + markup / 100);
  }
  return 0;
}
