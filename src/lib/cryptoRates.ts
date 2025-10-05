// Clean minimal in-memory crypto rates module
// Provides basic helpers and avoids undefined symbols from the previous broken version.

export interface ExchangeRate {
  currency: string;
  rub: number;
  lastUpdate: Date;
}

export type Rates = Record<string, ExchangeRate>;

// Initial sample rates; can be adjusted via updateRate()
const rates: Rates = {
  BTC: { currency: "BTC", rub: 10683297, lastUpdate: new Date() },
  ETH: { currency: "ETH", rub: 395453, lastUpdate: new Date() },
  USDT: { currency: "USDT", rub: 97.5, lastUpdate: new Date() },
};

// Optional markup configuration
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
  // broadcast update to any SSE clients (dev realtime)
  try {
    const key = '__SB_RATES_SSE_CLIENTS_V1__';
    const g: any = (globalThis as any) || {};
    const clients: Set<any> = g[key];
    if (clients && clients.size) {
      const payload = JSON.stringify(rates);
      for (const ctl of Array.from(clients)) {
        try {
          ctl.enqueue(`data: ${payload}\n\n`);
        } catch (e) {
          // ignore individual client errors
        }
      }
    }
  } catch (e) {
    // ignore
  }
}

export function getRateValue(fromCurrency: string, toCurrency: string): number {
  // RUB -> CRYPTO
  if (fromCurrency === "RUB") {
    const crypto = rates[toCurrency];
    if (!crypto) return 0;
    const markup = MARKUP_PERCENTAGE[toCurrency] ?? MARKUP_PERCENTAGE.default;
    return 1 / (crypto.rub * (1 + markup / 100));
  }
  // CRYPTO -> RUB
  if (toCurrency === "RUB") {
    const crypto = rates[fromCurrency];
    if (!crypto) return 0;
    const markup = MARKUP_PERCENTAGE[fromCurrency] ?? MARKUP_PERCENTAGE.default;
    return crypto.rub * (1 + markup / 100);
  }
  // Unsupported pair in this simple helper
  return 0;
}

